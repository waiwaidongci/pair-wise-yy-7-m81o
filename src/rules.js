// 判定规则模块：拆装许可、索具更换、返修复核、交付资格的全部业务判定都在这里。
// 本模块只读写传入的 db 对象，不直接碰文件系统。
import { clone } from "./store.js";

export class RuleError extends Error {
  constructor(code, message, status = 409, details = {}) {
    super(message);
    this.name = "RuleError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const itemStages = ["待检查", "校准中", "待复核", "已交付"];
export const permitStages = ["待拆桅", "待复核", "返修中", "已完工"];

// 各索位的标准索径、绕向、张力；完工登记三项实测值都要与此一致。
export const positionSpecs = [
  { position: "前桅侧支索", diameter: "1.2mm", lay: "S捻", tension: "中等" },
  { position: "后桅侧支索", diameter: "1.2mm", lay: "S捻", tension: "中等" },
  { position: "前桅升帆索", diameter: "0.8mm", lay: "Z捻", tension: "偏紧" },
  { position: "后桅升帆索", diameter: "0.8mm", lay: "Z捻", tension: "偏紧" },
  { position: "前桅稳索", diameter: "1.0mm", lay: "S捻", tension: "中等" },
  { position: "主桅斜桁索", diameter: "1.5mm", lay: "Z捻", tension: "偏紧" }
];

const specMap = new Map(positionSpecs.map(spec => [spec.position, spec]));
let seq = 0;
const now = () => new Date().toISOString();
const clean = value => (typeof value === "string" ? value.trim() : value ?? "");
const nonEmpty = value => clean(value) !== "";

function newPermitId() {
  seq = (seq + 1) % 1000;
  return "RX-" + Date.now() + "-" + String(seq).padStart(3, "0");
}

function findItem(db, itemCode) {
  return db.items.find(item => item.code === itemCode);
}

export function getPermit(db, permitId) {
  return db.permits.find(permit => permit.id === permitId);
}

// 拆装单未完工即视为占用中：占用替代卷号、占用目标索位，且卡住该模型的交付资格。
export function isActive(permit) {
  return permit && permit.status !== "已完工";
}

function activePermitOf(db, itemCode) {
  return db.permits.find(permit => permit.itemCode === itemCode && isActive(permit));
}

function reelOccupant(db, reelNo, itemCode) {
  return db.permits.find(
    permit => isActive(permit) && permit.reelNo === reelNo && permit.itemCode !== itemCode
  );
}

function participants(permit) {
  const names = new Set();
  if (permit.worker) names.add(permit.worker);
  if (permit.guardian) names.add(permit.guardian);
  for (const record of permit.reworks || []) names.add(record.by);
  for (const record of permit.reviews || []) names.add(record.by);
  return names;
}

// 实测三项（实际索径、绕向、张力）须与索位标准一致，原索径也须与标准索径对得上。
function evaluateCompletion(spec, input) {
  const checks = {
    originalDiameter: clean(input.originalDiameter) === spec.diameter,
    actualDiameter: clean(input.actualDiameter) === clean(input.originalDiameter),
    lay: clean(input.lay) === spec.lay,
    tension: clean(input.tension) === spec.tension
  };
  const expected = { diameter: spec.diameter, lay: spec.lay, tension: spec.tension };
  return { expected, checks, conform: Object.values(checks).every(Boolean) };
}

function summarizeItem(db, item) {
  const active = db.permits.filter(permit => permit.itemCode === item.code && isActive(permit));
  const permitCount = db.permits.filter(permit => permit.itemCode === item.code).length;
  const occupiedPositions = active.map(permit => permit.targetPosition);
  return {
    ...clone(item),
    permitCount,
    activePermitId: active[0]?.id || null,
    occupiedPositions,
    deliveryEligible: active.length === 0
  };
}

/* ---------------- 模型 ---------------- */

export function listItems(db) {
  return db.items.map(item => summarizeItem(db, item));
}

export function getItem(db, itemCode) {
  const item = findItem(db, itemCode);
  if (!item) throw new RuleError("item_not_found", "模型不存在", 404);
  return summarizeItem(db, item);
}

export function createItem(db, input) {
  if (!nonEmpty(input.code)) {
    throw new RuleError("code_required", "模型编号必填", 400);
  }
  const code = clean(input.code);
  if (findItem(db, code)) {
    throw new RuleError("code_conflict", "模型编号已存在", 409, { code });
  }
  const mastCount = input.mastCount === "" || input.mastCount == null ? undefined : Number(input.mastCount);
  const item = {
    code,
    shipType: clean(input.shipType),
    scale: clean(input.scale),
    mastCount: Number.isFinite(mastCount) ? mastCount : undefined,
    riggingMaterial: clean(input.riggingMaterial),
    owner: clean(input.owner),
    dueDate: clean(input.dueDate),
    status: itemStages.includes(input.status) ? input.status : "待检查",
    tasks: [],
    logs: [{ at: now(), step: "建档", note: "创建模型" }]
  };
  db.items.unshift(item);
  return summarizeItem(db, item);
}

export function updateItem(db, itemCode, input) {
  const item = findItem(db, itemCode);
  if (!item) throw new RuleError("item_not_found", "模型不存在", 404);
  if (nonEmpty(input.code) && clean(input.code) !== item.code) {
    throw new RuleError("code_immutable", "模型编号不可修改", 409);
  }
  for (const key of ["shipType", "scale", "riggingMaterial", "owner", "dueDate"]) {
    if (input[key] !== undefined) item[key] = clean(input[key]);
  }
  if (input.mastCount !== undefined && input.mastCount !== "") {
    const value = Number(input.mastCount);
    if (Number.isFinite(value)) item.mastCount = value;
  }
  if (input.status !== undefined) {
    if (!itemStages.includes(input.status)) {
      throw new RuleError("bad_status", "未知模型状态", 400, { status: input.status });
    }
    if (input.status !== item.status) {
      item.status = input.status;
      item.logs.push({ at: now(), step: "状态", note: "更新为" + input.status });
    }
  }
  return summarizeItem(db, item);
}

export function addItemLog(db, itemCode, input) {
  const item = findItem(db, itemCode);
  if (!item) throw new RuleError("item_not_found", "模型不存在", 404);
  item.logs.push({
    at: now(),
    step: clean(input.step) || "记录",
    note: clean(input.note) || ""
  });
  return summarizeItem(db, item);
}

/* ---------------- 拆装许可与索具更换 ---------------- */

export function listPermits(db, filters = {}) {
  const permits = filters.itemCode
    ? db.permits.filter(permit => permit.itemCode === filters.itemCode)
    : db.permits;
  return clone(permits);
}

// 拆桅前开单：目标索位、替代卷号、监护人、拆装人缺一不可；
// 同一模型只能有一张在执行的单；替代卷号不能被其他模型的在执行单占用。
export function createPermit(db, input) {
  const itemCode = clean(input.itemCode);
  const targetPosition = clean(input.targetPosition);
  const reelNo = clean(input.reelNo);
  const guardian = clean(input.guardian);
  const worker = clean(input.worker);

  if (!findItem(db, itemCode)) throw new RuleError("item_not_found", "模型不存在", 404);
  const missing = ["targetPosition", "reelNo", "guardian", "worker"].filter(key => !nonEmpty(input[key]));
  if (missing.length) {
    throw new RuleError("missing_fields", "拆装单缺少必填项", 409, { missing });
  }
  if (!specMap.has(targetPosition)) {
    throw new RuleError("unknown_position", "目标索位不在校准目录内", 409, { targetPosition });
  }
  const occupied = activePermitOf(db, itemCode);
  if (occupied) {
    throw new RuleError("permit_active", "该模型已有在执行的拆装单", 409, { permitId: occupied.id });
  }
  const holder = reelOccupant(db, reelNo, itemCode);
  if (holder) {
    throw new RuleError("reel_occupied", "替代卷号已被其他模型占用", 409, {
      reelNo,
      heldBy: holder.itemCode,
      permitId: holder.id
    });
  }

  const permit = {
    id: newPermitId(),
    itemCode,
    targetPosition,
    reelNo,
    batchNo: clean(input.batchNo),
    guardian,
    worker,
    disassembleAt: clean(input.disassembleAt) || now(),
    status: "待拆桅",
    conclusion: null,
    completion: null,
    reworks: [],
    reviews: [],
    history: [],
    version: 1,
    createdAt: now(),
    releasedAt: null,
    events: [{ at: now(), type: "开单", by: worker, note: "拆桅许可已签发，监护人：" + guardian }]
  };
  db.permits.unshift(permit);
  findItem(db, itemCode).logs.push({
    at: now(),
    step: "拆装许可",
    note: permit.id + " 开单，目标索位 " + targetPosition + "，替代卷号 " + reelNo
  });
  return clone(permit);
}

// 完工登记：原索径、实际索径、绕向、张力四项；任一不符只能转返修，不直接放行。
export function completePermit(db, permitId, input) {
  const permit = getPermit(db, permitId);
  if (!permit) throw new RuleError("permit_not_found", "拆装单不存在", 404);
  if (!isActive(permit)) {
    throw new RuleError("permit_closed", "拆装单已完工", 409, { permitId });
  }
  const required = ["originalDiameter", "actualDiameter", "lay", "tension"];
  const missing = required.filter(key => !nonEmpty(input[key]));
  if (missing.length) {
    throw new RuleError("missing_fields", "完工登记缺少必填项", 400, { missing });
  }
  const spec = specMap.get(permit.targetPosition);
  if (!spec) throw new RuleError("unknown_position", "目标索位无校准标准", 409);

  const by = nonEmpty(input.by) ? clean(input.by) : permit.worker;
  const result = evaluateCompletion(spec, input);
  permit.completion = {
    at: now(),
    by,
    originalDiameter: clean(input.originalDiameter),
    actualDiameter: clean(input.actualDiameter),
    lay: clean(input.lay),
    tension: clean(input.tension),
    note: clean(input.note),
    expected: result.expected,
    checks: result.checks
  };
  if (result.conform) {
    permit.status = "待复核";
    permit.conclusion = "合格待复核";
  } else {
    permit.status = "返修中";
    permit.conclusion = "不符转返修";
  }
  permit.events.push({
    at: permit.completion.at,
    type: "完工登记",
    by,
    note: permit.conclusion + "（原索径 " + permit.completion.originalDiameter + " / 实际索径 " +
      permit.completion.actualDiameter + " / " + permit.completion.lay + " / " + permit.completion.tension + "）"
  });
  findItem(db, permit.itemCode).logs.push({
    at: permit.completion.at,
    step: "完工登记",
    note: permit.id + " " + permit.conclusion
  });
  return clone(permit);
}

// 返修登记：返修人不能与拆装人相同。
export function reworkPermit(db, permitId, input) {
  const permit = getPermit(db, permitId);
  if (!permit) throw new RuleError("permit_not_found", "拆装单不存在", 404);
  if (permit.status !== "返修中") {
    throw new RuleError("not_in_rework", "拆装单当前不在返修状态", 409, { status: permit.status });
  }
  if (!nonEmpty(input.by)) {
    throw new RuleError("missing_fields", "返修人必填", 400, { missing: ["by"] });
  }
  const by = clean(input.by);
  if (by === permit.worker) {
    throw new RuleError("same_person", "返修人不能与拆装人相同", 409, { worker: permit.worker });
  }
  const record = { at: now(), by, note: clean(input.note) };
  permit.reworks.push(record);
  permit.status = "待复核";
  permit.conclusion = "返修待复核";
  permit.events.push({ at: record.at, type: "返修", by, note: record.note || "已按返修意见处理" });
  findItem(db, permit.itemCode).logs.push({
    at: record.at,
    step: "返修",
    note: permit.id + " 返修人 " + by
  });
  return clone(permit);
}

// 复核：必须由未参与过本单的人执行；合格才释放原索位并恢复交付资格，不合格打回返修。
export function reviewPermit(db, permitId, input) {
  const permit = getPermit(db, permitId);
  if (!permit) throw new RuleError("permit_not_found", "拆装单不存在", 404);
  if (permit.status !== "待复核") {
    throw new RuleError("not_pending_review", "拆装单当前不待复核", 409, { status: permit.status });
  }
  if (!nonEmpty(input.by)) {
    throw new RuleError("missing_fields", "复核人必填", 400, { missing: ["by"] });
  }
  const by = clean(input.by);
  const involved = participants(permit);
  if (involved.has(by)) {
    throw new RuleError("reviewer_conflict", "复核人须为未参与本单的人员", 409, {
      participants: [...involved]
    });
  }

  const pass = input.pass !== false;
  const record = { at: now(), by, pass, note: clean(input.note) };
  permit.reviews.push(record);
  if (pass) {
    permit.status = "已完工";
    permit.conclusion = "复核合格";
    permit.releasedAt = record.at;
    permit.events.push({ at: record.at, type: "复核", by, note: "合格，原索位已释放，交付资格恢复" });
  } else {
    permit.status = "返修中";
    permit.conclusion = "复核不合格转返修";
    permit.events.push({ at: record.at, type: "复核", by, note: record.note || "不合格，退回返修" });
  }
  findItem(db, permit.itemCode).logs.push({
    at: record.at,
    step: "复核",
    note: permit.id + " " + permit.conclusion + "，复核人 " + by
  });
  return clone(permit);
}

// 更换索具批次或修改拆装时间：未交付的结论立即失效，回到待拆桅重新走流程；
// 旧结论整体存入 history，旧单编号与历史版本仍可查。
export function editPermit(db, permitId, input) {
  const permit = getPermit(db, permitId);
  if (!permit) throw new RuleError("permit_not_found", "拆装单不存在", 404);
  if (permit.status === "已完工") {
    throw new RuleError("permit_delivered", "已交付单不可修改，旧单仅可查阅", 409, { permitId });
  }
  const patch = {};
  if (input.batchNo !== undefined) patch.batchNo = clean(input.batchNo);
  if (input.disassembleAt !== undefined) patch.disassembleAt = clean(input.disassembleAt);
  if (!Object.keys(patch).length) {
    throw new RuleError("missing_fields", "仅允许修改索具批次或拆装时间", 400);
  }

  const reasons = [];
  if (patch.batchNo !== undefined && patch.batchNo !== permit.batchNo) reasons.push("索具批次变更");
  if (patch.disassembleAt !== undefined && patch.disassembleAt !== permit.disassembleAt) reasons.push("拆装时间变更");
  if (!reasons.length) return { changed: false, permit: clone(permit) };

  permit.history.push({
    version: permit.version,
    at: now(),
    reason: reasons.join("、"),
    snapshot: {
      batchNo: permit.batchNo,
      disassembleAt: permit.disassembleAt,
      status: permit.status,
      conclusion: permit.conclusion,
      completion: clone(permit.completion),
      reworks: clone(permit.reworks),
      reviews: clone(permit.reviews)
    }
  });
  Object.assign(permit, patch);
  permit.version += 1;
  permit.status = "待拆桅";
  permit.conclusion = null;
  permit.completion = null;
  permit.reworks = [];
  permit.reviews = [];
  permit.releasedAt = null;
  permit.events.push({
    at: now(),
    type: "结论失效",
    by: clean(input.by) || "",
    note: reasons.join("、") + "，第 " + permit.version + " 版重新判定"
  });
  findItem(db, permit.itemCode).logs.push({
    at: now(),
    step: "拆装单改版",
    note: permit.id + " " + reasons.join("、") + "，未交付结论失效重算"
  });
  return { changed: true, permit: clone(permit) };
}

/* ---------------- 统计 ---------------- */

export function stats(db) {
  const itemStats = Object.fromEntries(itemStages.map(label => [label, 0]));
  for (const item of db.items) {
    if (itemStats[item.status] !== undefined) itemStats[item.status] += 1;
  }
  const permitStats = Object.fromEntries(permitStages.map(label => [label, 0]));
  for (const permit of db.permits) {
    if (permitStats[permit.status] !== undefined) permitStats[permit.status] += 1;
  }
  const activePermits = db.permits.filter(isActive);
  return {
    items: itemStats,
    permits: permitStats,
    totalItems: db.items.length,
    deliveryEligible: db.items.length - new Set(activePermits.map(permit => permit.itemCode)).size,
    occupiedReels: new Set(activePermits.map(permit => permit.reelNo)).size,
    occupiedPositions: activePermits.length
  };
}
