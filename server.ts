// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserTools } from "./src/tools/user-tools.js";
import { registerAdminTools } from "./src/tools/admin-tools.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "pep-collector",
    version: "1.0.0",
  });

  registerUserTools(server);
  registerAdminTools(server);

  return server;
}
