// 入口路由模块：只做 URL 解析、参数收集、调用判定规则、HTTP 状态码映射。
// 不写业务规则，不直接读写存储文件。
import { loadDb, saveDb } from "./store.js";
import * as rules from "./rules.js";
import { page } from "./page.js";

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("请求体不是合法 JSON");
    error.status = 400;
    error.code = "bad_json";
    throw error;
  }
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function html(res, text) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(text);
}

// 调用规则模块；返回 { status, body, persist }。规则抛 RuleError 时映射对应状态码。
async function apply(req, res, fn) {
  const db = await loadDb();
  try {
    const result = await fn(db);
    if (result?.persist !== false) await saveDb(db);
    send(res, result?.status ?? 200, result?.body ?? result);
  } catch (error) {
    const status = error.status || 500;
    send(res, status, { error: error.code || "internal_error", message: error.message, ...(error.details ? { details: error.details } : {}) });
  }
}

export async function route(req, res, url) {
  const p = url.pathname;

  if (req.method === "GET" && p === "/") return html(res, page());

  if (req.method === "GET" && p === "/api/items") {
    return apply(req, res, db => ({ status: 200, body: rules.listItems(db), persist: false }));
  }
  if (req.method === "POST" && p === "/api/items") {
    const input = await readBody(req);
    return apply(req, res, db => ({ status: 201, body: rules.createItem(db, input) }));
  }
  if (req.method === "GET" && p === "/api/specs") {
    return apply(req, res, db => ({ status: 200, body: rules.positionSpecs, persist: false }));
  }
  if (req.method === "GET" && p === "/api/stats") {
    return apply(req, res, db => ({ status: 200, body: rules.stats(db), persist: false }));
  }
  if (req.method === "GET" && p === "/api/permits") {
    return apply(req, res, db => ({ status: 200, body: rules.listPermits(db, { itemCode: url.searchParams.get("itemCode") }), persist: false }));
  }
  if (req.method === "POST" && p === "/api/permits") {
    const input = await readBody(req);
    return apply(req, res, db => ({ status: 201, body: rules.createPermit(db, input) }));
  }

  let m;
  if ((m = p.match(/^\/api\/items\/([^/]+)$/))) {
    const code = decodeURIComponent(m[1]);
    if (req.method === "GET") {
      return apply(req, res, db => ({ status: 200, body: rules.getItem(db, code), persist: false }));
    }
    if (req.method === "PATCH") {
      const input = await readBody(req);
      return apply(req, res, db => ({ status: 200, body: rules.updateItem(db, code, input) }));
    }
  }
  if ((m = p.match(/^\/api\/items\/([^/]+)\/logs$/)) && req.method === "POST") {
    const input = await readBody(req);
    return apply(req, res, db => ({ status: 201, body: rules.addItemLog(db, decodeURIComponent(m[1]), input) }));
  }
  if ((m = p.match(/^\/api\/permits\/([^/]+)$/))) {
    const id = decodeURIComponent(m[1]);
    if (req.method === "GET") {
      return apply(req, res, db => {
        const permit = rules.getPermit(db, id);
        if (!permit) {
          const error = new Error("拆装单不存在");
          error.status = 404; error.code = "permit_not_found";
          throw error;
        }
        return { status: 200, body: permit, persist: false };
      });
    }
    if (req.method === "PATCH") {
      const input = await readBody(req);
      return apply(req, res, db => {
        const { changed, permit } = rules.editPermit(db, id, input);
        return { status: changed ? 200 : 200, body: permit };
      });
    }
  }
  if ((m = p.match(/^\/api\/permits\/([^/]+)\/complete$/)) && req.method === "POST") {
    const input = await readBody(req);
    return apply(req, res, db => ({ status: 200, body: rules.completePermit(db, decodeURIComponent(m[1]), input) }));
  }
  if ((m = p.match(/^\/api\/permits\/([^/]+)\/rework$/)) && req.method === "POST") {
    const input = await readBody(req);
    return apply(req, res, db => ({ status: 200, body: rules.reworkPermit(db, decodeURIComponent(m[1]), input) }));
  }
  if ((m = p.match(/^\/api\/permits\/([^/]+)\/review$/)) && req.method === "POST") {
    const input = await readBody(req);
    return apply(req, res, db => ({ status: 200, body: rules.reviewPermit(db, decodeURIComponent(m[1]), input) }));
  }

  send(res, 404, { error: "not_found", message: "未知路由" });
}
