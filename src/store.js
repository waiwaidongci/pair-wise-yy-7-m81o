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
  orders: []
};

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  db.items ||= [];
  db.orders ||= [];
  return db;
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export function itemKey(item) {
  return item.id || item.code;
}

export function findItem(db, key) {
  const raw = String(key);
  return db.items.find(x => x.id === raw || x.code === raw) || null;
}

export function findOrder(db, id) {
  return db.orders.find(x => x.id === id) || null;
}

export function ordersOfModel(db, item) {
  const key = itemKey(item);
  return db.orders.filter(o => o.modelId === key);
}

export function newItemId() {
  return "MR-" + Date.now();
}

export function newOrderId() {
  return "DO-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
}
