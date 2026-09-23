import { loadDb, saveDb, findItem, findOrder, ordersOfModel, newItemId } from "./store.js";
import * as rules from "./rules.js";
import { page } from "./page.js";

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function html(res, text) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(text);
}

function failure(res, result) {
  return send(res, result.status, { error: result.error, message: result.message });
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();
    const path = url.pathname;

    if (req.method === "GET" && path === "/") return html(res, page());
    if (req.method === "GET" && path === "/api/items") {
      return send(res, 200, db.items.map(item => rules.summarizeItem(db, item)));
    }
    if (req.method === "POST" && path === "/api/items") {
      const result = rules.createModel(db, await body(req), newItemId());
      await saveDb(db);
      return send(res, 201, result.item);
    }
    if (req.method === "GET" && path === "/api/stats") return send(res, 200, rules.computeStats(db));
    if (req.method === "GET" && path === "/api/orders") {
      const status = url.searchParams.get("status");
      const model = url.searchParams.get("model");
      let orders = db.orders.slice();
      if (model) {
        const item = findItem(db, model);
        orders = orders.filter(o => o.modelId === (item ? item.id || item.code : model));
      }
      if (status) orders = orders.filter(o => o.status === status);
      return send(res, 200, orders);
    }

    const itemOrders = path.match(/^\/api\/items\/([^/]+)\/orders$/);
    if (itemOrders) {
      const item = findItem(db, decodeURIComponent(itemOrders[1]));
      if (!item) return send(res, 404, { error: "item_not_found", message: "模型不存在" });
      if (req.method === "GET") return send(res, 200, ordersOfModel(db, item));
      if (req.method === "POST") {
        const result = rules.openOrder(db, item, await body(req));
        if (!result.ok) return failure(res, result);
        await saveDb(db);
        return send(res, 201, result.order);
      }
    }

    const orderAction = path.match(/^\/api\/orders\/([^/]+)\/(complete|rework-done|review)$/);
    if (orderAction && req.method === "POST") {
      const order = findOrder(db, decodeURIComponent(orderAction[1]));
      if (!order) return send(res, 404, { error: "order_not_found", message: "拆装单不存在" });
      const item = findItem(db, order.modelId);
      const handlers = { complete: rules.completeOrder, "rework-done": rules.finishRework, review: rules.reviewOrder };
      const result = handlers[orderAction[2]](db, item, order, await body(req));
      if (!result.ok) return failure(res, result);
      await saveDb(db);
      return send(res, 200, { outcome: result.outcome || "ok", order });
    }

    const orderOne = path.match(/^\/api\/orders\/([^/]+)$/);
    if (orderOne && req.method === "GET") {
      const order = findOrder(db, decodeURIComponent(orderOne[1]));
      if (!order) return send(res, 404, { error: "order_not_found", message: "拆装单不存在" });
      return send(res, 200, order);
    }
    if (orderOne && req.method === "PATCH") {
      const order = findOrder(db, decodeURIComponent(orderOne[1]));
      if (!order) return send(res, 404, { error: "order_not_found", message: "拆装单不存在" });
      const item = findItem(db, order.modelId);
      const result = rules.adjustOrder(db, item, order, await body(req));
      if (!result.ok) return failure(res, result);
      await saveDb(db);
      return send(res, 200, { changed: result.changed, invalidated: result.invalidated, order });
    }

    const itemLogs = path.match(/^\/api\/items\/([^/]+)\/logs$/);
    if (itemLogs && req.method === "POST") {
      const item = findItem(db, decodeURIComponent(itemLogs[1]));
      if (!item) return send(res, 404, { error: "item_not_found", message: "模型不存在" });
      rules.appendNote(item, await body(req));
      await saveDb(db);
      return send(res, 201, rules.summarizeItem(db, item));
    }

    const itemAction = path.match(/^\/api\/items\/([^/]+)\/action$/);
    if (itemAction && req.method === "POST") {
      const item = findItem(db, decodeURIComponent(itemAction[1]));
      if (!item) return send(res, 404, { error: "item_not_found", message: "模型不存在" });
      rules.appendTask(item, await body(req));
      await saveDb(db);
      return send(res, 201, rules.summarizeItem(db, item));
    }

    const itemOne = path.match(/^\/api\/items\/([^/]+)$/);
    if (itemOne && req.method === "GET") {
      const item = findItem(db, decodeURIComponent(itemOne[1]));
      if (!item) return send(res, 404, { error: "item_not_found", message: "模型不存在" });
      return send(res, 200, rules.itemDetail(db, item));
    }
    if (itemOne && req.method === "PATCH") {
      const item = findItem(db, decodeURIComponent(itemOne[1]));
      if (!item) return send(res, 404, { error: "item_not_found", message: "模型不存在" });
      const result = rules.patchModel(db, item, await body(req));
      if (!result.ok) return failure(res, result);
      await saveDb(db);
      return send(res, 200, rules.summarizeItem(db, item));
    }

    send(res, 404, { error: "not_found" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
}
