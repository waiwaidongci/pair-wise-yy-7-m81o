import http from "node:http";
import { handleRequest } from "./src/routes.js";

const port = Number(process.env.PORT || 3038);

const server = http.createServer(handleRequest);
server.listen(port, () => console.log("古船模型拆装许可与索具更换追踪 listening on http://localhost:" + port));
