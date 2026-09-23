// 存储读写模块：只负责 data JSON 的装载、迁移与落盘，不含任何业务判定。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "model-rigging-calibration.json");

const seed = {
  items: [
    {
      code: "MR-001",
      shipType: "福船",
      scale: "1:48",
      mastCount: 3,
      riggingMaterial: "蜡线",
      owner: "周宁",
      dueDate: "2026-06-28",
      status: "校准中",
      tasks: [
        {
          id: "T-1",
          position: "前桅侧支索",
          tension: "偏松",
          status: "调整中",
          logs: [{ at: "2026-06-12", note: "已缩短2mm" }]
        }
      ],
      logs: []
    }
  ],
  permits: []
};

function migrate(db) {
  // 旧版数据只有 items，补齐拆装单集合。
  if (!Array.isArray(db.items)) db.items = [];
  if (!Array.isArray(db.permits)) db.permits = [];
  for (const item of db.items) {
    item.logs ||= [];
    item.tasks ||= [];
  }
  return db;
}

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
    return migrate(structuredClone(seed));
  }
  const raw = await readFile(dbPath, "utf8");
  return migrate(JSON.parse(raw || "{}"));
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export function clone(value) {
  return structuredClone(value);
}
