// main.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { applySchema } from "./src/lib/neo4j/schema.js";
import { seedBuiltinSources } from "./src/lib/sources/seed.js";
import { verifyToken } from "./src/lib/auth/verify-token.js";
import { getActiveCrawlers } from "./src/lib/crawlers/registry.js";
import { runCrawlerPipeline } from "./src/lib/crawlers/pipeline.js";
import { logger } from "./src/lib/logger.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const isStdio = process.argv.includes("--stdio");

async function initialize(): Promise<void> {
  logger.info("Initializing database schema...");
  await applySchema();
  await seedBuiltinSources();
  logger.info("Database ready.");
}

function setupCronSchedule(): void {
  const schedule = process.env.CRAWL_SCHEDULE;
  if (!schedule) {
    logger.info("No CRAWL_SCHEDULE set — crawls are on-demand only.");
    return;
  }
  if (!cron.validate(schedule)) {
    logger.error(`Invalid CRAWL_SCHEDULE: "${schedule}" — skipping.`);
    return;
  }
  logger.info(`Scheduled crawls: "${schedule}"`);
  cron.schedule(schedule, async () => {
    logger.info("Scheduled crawl starting...");
    try {
      const crawlers = await getActiveCrawlers();
      for (const crawler of crawlers) {
        const result = await runCrawlerPipeline(crawler);
        logger.info(
          `  ${result.source}: ${result.recordCount} records, ${result.errors.length} errors`
        );
      }
      logger.info("Scheduled crawl complete.");
    } catch (err) {
      logger.error("Scheduled crawl failed", err);
    }
  });
}

async function startHttpServer(): Promise<void> {
  const app = express();

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim());
  if (!allowedOrigins) {
    logger.warn(
      "ALLOWED_ORIGINS is not set — CORS will reject all cross-origin requests. " +
        "Set ALLOWED_ORIGINS to a comma-separated list of allowed origins."
    );
  }
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins ?? false,
      credentials: !!allowedOrigins,
    })
  );

  // Rate limiting: 100 requests per 15-minute window per IP
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later." },
    })
  );

  app.use(express.json());

  // OAuth protected resource metadata
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({
      resource: process.env.AUTH0_AUDIENCE || "https://pep-collector/api",
      authorization_servers: [process.env.AUTH0_ISSUER_BASE_URL].filter(
        Boolean
      ),
      bearer_methods_supported: ["header"],
    });
  });

  // Request timeout: 30 seconds for all routes
  app.use((_req, res, next) => {
    res.setTimeout(30_000, () => {
      if (!res.headersSent) {
        res.status(408).json({ error: "Request timeout" });
      }
    });
    next();
  });

  // MCP endpoint
  app.post("/mcp", async (req, res) => {
    try {
      // Extract and verify auth
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;
      const authInfo = await verifyToken(bearerToken);

      if (!authInfo) {
        res
          .status(401)
          .json({ error: "Unauthorized: invalid or missing token" });
        return;
      }

      // Create server instance per request (stateless HTTP)
      const server = createServer();

      // Attach auth info so tools can access it
      (server as any).authInfo = authInfo;

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error("MCP endpoint error", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.listen(PORT, () => {
    logger.info(`MCP server listening on http://localhost:${PORT}/mcp`);
  });
}

async function startStdioServer(): Promise<void> {
  const server = createServer();

  // Stdio is a local trusted connection — grant all permissions
  (server as any).authInfo = {
    clientId: "local-stdio",
    permissions: ["screen:read", "admin:manage"],
  };

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server running on stdio");
}

async function main(): Promise<void> {
  await initialize();
  setupCronSchedule();

  if (isStdio) {
    await startStdioServer();
  } else {
    await startHttpServer();
  }
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
