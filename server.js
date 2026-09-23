import http from "node:http";
import { route } from "./src/routes.js";

const port = Number(process.env.PORT || 3038);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    await route(req, res, url);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(error.status || 500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error.code || "internal_error", message: error.message }));
    }
  }
});

server.listen(port, () =>
  console.log("古船模型拆装许可与索具更换追踪台 listening on http://localhost:" + port)
);
