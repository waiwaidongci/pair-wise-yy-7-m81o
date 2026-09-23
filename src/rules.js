import { itemKey, newOrderId, ordersOfModel } from "./store.js";

export const MODEL_STAGES = ["待检查", "校准中", "待复核", "已交付"];
export const ORDER_STAGES = ["进行中", "返修中", "待复核", "合格"];
export const ACTIVE_ORDER_STAGES = ["进行中", "返修中", "待复核"];

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error, message, status = 409) => ({ ok: false, status, error, message });
const clean = v => String(v ?? "").trim();
const now = () => new Date().toISOString();

export function isActiveOrder(order) {
  return ACTIVE_ORDER_STAGES.includes(order.status);
}

export function activeOrderOf(db, key) {
  return db.orders.find(o => o.modelId === key && isActiveOrder(o)) || null;
}

export function spoolConflict(db, spoolNo, key) {
  const target = clean(spoolNo);
  return db.orders.find(o => o.modelId !== key && isActiveOrder(o) && clean(o.spoolNo) === target) || null;
}

export function deliveryEligible(db, key) {
  return !activeOrderOf(db, key);
}

export function lockedPositions(db, key) {
  return db.orders.filter(o => o.modelId === key && isActiveOrder(o)).map(o => o.targetPosition);
}

export function missingFields(input, names) {
  return names.filter(n => !clean(input[n]));
}

function logOrder(order, step, note) {
  order.logs ||= [];
  order.logs.push({ at: now(), step, note });
}

function logItem(item, step, note) {
  item.logs ||= [];
  item.logs.push({ at: now(), step, note });
}

export function createModel(db, input, id) {
  const item = { id, ...input, tasks: [], logs: [{ at: now(), step: "建档", note: "创建模型" }] };
  db.items.unshift(item);
  return ok({ item });
}

export function patchModel(db, item, input) {
  if (input.status === "已交付" && !deliveryEligible(db, itemKey(item))) {
    return fail("not_eligible", "存在未完结拆装单，交付资格未恢复，不能交付");
  }
  Object.assign(item, input);
  logItem(item, "状态", "更新为" + item.status);
  return ok({ item });
}

export function appendNote(item, input) {
  logItem(item, input.step || "记录", input.note || "");
  return ok({ item });
}

export function appendTask(item, input) {
  item.tasks ||= [];
  item.tasks.push({
    id: "T-" + Date.now(),
    position: input.position,
    tension: input.tension,
    status: "待检查",
    logs: [{ at: now(), note: input.note || "新增帆索任务" }]
  });
  item.status = "校准中";
  logItem(item, "帆索", (input.position || "") + " · " + (input.tension || ""));
  return ok({ item });
}

// 拆桅前开立拆装单：目标索位、替代卷号、监护人必填；卷号不得被其他模型占用；
// 每个模型同时只能有一张未完结拆装单。任何一条不满足都返回 409 且不写记录。
export function openOrder(db, item, input) {
  const key = itemKey(item);
  const missing = missingFields(input, ["targetPosition", "spoolNo", "supervisor"]);
  const operator = clean(input.operator) || clean(item.owner);
  if (!operator) missing.push("operator(拆装人)");
  if (missing.length) return fail("missing_field", "缺少必填项：" + missing.join("、"));
  const existing = activeOrderOf(db, key);
  if (existing) return fail("order_exists", `模型 ${item.code || key} 已有未完结拆装单 ${existing.id}`);
  const conflict = spoolConflict(db, input.spoolNo, key);
  if (conflict) return fail("spool_occupied", `卷号 ${clean(input.spoolNo)} 正被模型 ${conflict.modelCode || conflict.modelId} 占用`);
  const order = {
    id: newOrderId(),
    modelId: key,
    modelCode: item.code || key,
    targetPosition: clean(input.targetPosition),
    spoolNo: clean(input.spoolNo),
    supervisor: clean(input.supervisor),
    operator,
    scheduledAt: clean(input.scheduledAt),
    riggingBatch: clean(input.riggingBatch),
    plan: {
      diameter: clean(input.planDiameter ?? input.plan?.diameter),
      winding: clean(input.planWinding ?? input.plan?.winding),
      tension: clean(input.planTension ?? input.plan?.tension)
    },
    status: "进行中",
    createdAt: now(),
    completion: null,
    rework: null,
    review: null,
    history: [],
    logs: []
  };
  logOrder(order, "开立", `目标索位 ${order.targetPosition} · 卷号 ${order.spoolNo} · 监护人 ${order.supervisor} · 拆装人 ${order.operator}`);
  db.orders.unshift(order);
  if (item.status === "已交付") {
    item.status = "校准中";
    logItem(item, "交付资格", "新开拆装单，交付资格暂停");
  }
  logItem(item, "拆装单", `开立 ${order.id} · ${order.targetPosition}`);
  return ok({ order });
}

// 完工登记：原索径、实际索径、绕向、张力四项必录；
// 与计划值逐项比对，任一项不符只能转返修，且返修人不能与拆装人相同。
export function completeOrder(db, item, order, input) {
  if (order.status !== "进行中") {
    return fail("bad_state", `拆装单 ${order.id} 当前为「${order.status}」，不能完工登记`);
  }
  const missing = missingFields(input, ["originalDiameter", "actualDiameter", "winding", "tension"]);
  if (missing.length) return fail("missing_field", "完工登记缺少：" + missing.join("、"));
  const plan = order.plan || {};
  const compare = [
    ["实际索径", plan.diameter, input.actualDiameter],
    ["绕向", plan.winding, input.winding],
    ["张力", plan.tension, input.tension]
  ];
  const nonConform = compare
    .filter(([, planned]) => clean(planned) !== "")
    .filter(([, planned, actual]) => clean(actual) !== clean(planned))
    .map(([label]) => label);
  const conform = nonConform.length === 0;
  const reworker = clean(input.reworker);
  if (!conform) {
    if (!reworker) return fail("missing_field", `不符项：${nonConform.join("、")}，须指定返修人才能转返修`);
    if (reworker === order.operator) return fail("reworker_conflict", "返修人不能与拆装人相同");
  }
  order.completion = {
    originalDiameter: clean(input.originalDiameter),
    actualDiameter: clean(input.actualDiameter),
    winding: clean(input.winding),
    tension: clean(input.tension),
    at: now(),
    conform,
    nonConform
  };
  if (conform) {
    order.status = "合格";
    logOrder(order, "完工", "原索径/实际索径/绕向/张力登记相符，判定合格，释放原索位");
    logItem(item, "拆装单", `${order.id} 完工合格，释放原索位并恢复交付资格`);
    return ok({ outcome: "合格" });
  }
  order.rework = { reworker, note: clean(input.note), at: now(), doneAt: null };
  order.status = "返修中";
  logOrder(order, "完工", `不符项：${nonConform.join("、")}，转返修（返修人 ${reworker}）`);
  logItem(item, "拆装单", `${order.id} 完工不符（${nonConform.join("、")}），转返修`);
  return ok({ outcome: "返修", nonConform });
}

export function finishRework(db, item, order) {
  if (order.status !== "返修中") {
    return fail("bad_state", `拆装单 ${order.id} 当前为「${order.status}」，不能提交返修完成`);
  }
  order.rework ||= {};
  order.rework.doneAt = now();
  order.status = "待复核";
  logOrder(order, "返修", "返修完成，待复核");
  return ok({ outcome: "待复核" });
}

// 返修后由未参与人员复核（非拆装人/返修人/监护人）；
// 合格才释放原索位并恢复交付资格，不合格退回返修。
export function reviewOrder(db, item, order, input) {
  if (order.status !== "待复核") {
    return fail("bad_state", `拆装单 ${order.id} 当前为「${order.status}」，不能复核`);
  }
  const reviewer = clean(input.reviewer);
  if (!reviewer) return fail("missing_field", "缺少必填项：reviewer(复核人)");
  const involved = [order.operator, order.rework?.reworker, order.supervisor].filter(Boolean);
  if (involved.includes(reviewer)) return fail("reviewer_involved", "复核人须为未参与本单的人员");
  const pass = [true, "true", "合格", "pass", "1", 1].includes(input.pass);
  order.review = { reviewer, pass, note: clean(input.note), at: now() };
  if (pass) {
    order.status = "合格";
    logOrder(order, "复核", `复核人 ${reviewer} 判定合格，释放原索位`);
    logItem(item, "拆装单", `${order.id} 复核合格，释放原索位并恢复交付资格`);
    return ok({ outcome: "合格" });
  }
  order.status = "返修中";
  if (order.rework) order.rework.doneAt = null;
  logOrder(order, "复核", `复核人 ${reviewer} 判定不合格，退回返修`);
  logItem(item, "拆装单", `${order.id} 复核不合格，退回返修`);
  return ok({ outcome: "返修" });
}

// 更换索具批次或修改拆装时间：未交付结论失效重算，旧结论存入 history 仍可查。
export function adjustOrder(db, item, order, input) {
  const changes = [];
  if (input.riggingBatch !== undefined && clean(input.riggingBatch) !== "" && clean(input.riggingBatch) !== clean(order.riggingBatch)) {
    changes.push({ field: "riggingBatch", label: "更换索具批次", from: clean(order.riggingBatch), to: clean(input.riggingBatch) });
  }
  if (input.scheduledAt !== undefined && clean(input.scheduledAt) !== "" && clean(input.scheduledAt) !== clean(order.scheduledAt)) {
    changes.push({ field: "scheduledAt", label: "修改拆装时间", from: clean(order.scheduledAt), to: clean(input.scheduledAt) });
  }
  if (!changes.length) return ok({ changed: false, invalidated: false });
  for (const c of changes) order[c.field] = c.to;
  const reason = changes.map(c => c.label).join("；");
  let invalidated = false;
  if (order.status !== "进行中" && item.status !== "已交付") {
    order.history ||= [];
    order.history.push({
      invalidatedAt: now(),
      reason,
      previousStatus: order.status,
      completion: order.completion,
      rework: order.rework,
      review: order.review
    });
    order.status = "进行中";
    order.completion = null;
    order.rework = null;
    order.review = null;
    invalidated = true;
    logItem(item, "拆装单", `${order.id} 因${reason}，未交付结论失效，重算交付资格`);
  }
  logOrder(order, "调整", changes.map(c => `${c.label}：${c.from || "空"} → ${c.to || "空"}`).join("；") + (invalidated ? "，结论失效重算" : ""));
  return ok({ changed: true, invalidated });
}

export function summarizeItem(db, item) {
  const key = itemKey(item);
  const orders = ordersOfModel(db, item);
  const active = orders.find(isActiveOrder) || null;
  const logCount = (item.logs || []).length + (item.tasks || []).reduce((n, t) => n + (t.logs || []).length, 0);
  return {
    ...item,
    logCount,
    orderCount: orders.length,
    activeOrder: active
      ? { id: active.id, status: active.status, targetPosition: active.targetPosition, spoolNo: active.spoolNo }
      : null,
    deliveryEligible: !active,
    lockedPositions: lockedPositions(db, key)
  };
}

export function itemDetail(db, item) {
  const orders = ordersOfModel(db, item)
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { ...summarizeItem(db, item), orders };
}

export function computeStats(db) {
  const models = Object.fromEntries(MODEL_STAGES.map(s => [s, 0]));
  for (const item of db.items) if (models[item.status] !== undefined) models[item.status] += 1;
  const orders = Object.fromEntries(ORDER_STAGES.map(s => [s, 0]));
  for (const order of db.orders) if (orders[order.status] !== undefined) orders[order.status] += 1;
  return { models, orders };
}
