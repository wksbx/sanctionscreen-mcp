// src/tools/admin-tools.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getAllSources,
  getSourceBySourceId,
  createSource,
  updateSource,
  deleteSource,
} from "../lib/sources/repository.js";
import { getCrawlerBySourceId, getActiveCrawlers } from "../lib/crawlers/registry.js";
import { runCrawlerPipeline } from "../lib/crawlers/pipeline.js";
import { getDriver } from "../lib/neo4j/client.js";
import { buildDataStatusQuery } from "../lib/neo4j/queries.js";
import type { AuthInfo } from "../lib/auth/permissions.js";
import { requirePermission } from "../lib/auth/permissions.js";
import { DEFAULT_MATCHING_CONFIG, type MatchingConfig } from "../lib/types.js";
import {
  formatSourceList,
  formatCrawlStatus,
  formatMatchingConfig,
} from "./formatters.js";
import { validateExternalUrl, SsrfError } from "../lib/security/validate-url.js";
import { audit } from "../lib/security/audit.js";

const DIST_UI = path.join(process.cwd(), "dist", "ui");

function getAuth(server: McpServer): AuthInfo {
  return (server as McpServer & { authInfo: AuthInfo }).authInfo;
}

async function readUiHtml(uiName: string): Promise<string> {
  return fs.readFile(path.join(DIST_UI, uiName, "index.html"), "utf-8");
}

// In-memory matching config (could be persisted to Neo4j later)
let matchingConfig: MatchingConfig = { ...DEFAULT_MATCHING_CONFIG };

export function registerAdminTools(server: McpServer): void {
  // --- list_sources ---
  server.tool(
    "list_sources",
    "List all configured data sources.",
    {
      enabled_only: z
        .boolean()
        .optional()
        .describe("Only show enabled sources (default false)"),
    },
    async ({ enabled_only }) => {
      requirePermission(getAuth(server), "admin:manage");
      const sources = await getAllSources();
      const filtered = enabled_only
        ? sources.filter((s) => s.enabled)
        : sources;
      return {
        content: [
          { type: "text" as const, text: formatSourceList(filtered) },
        ],
      };
    }
  );

  // --- create_source ---
  server.tool(
    "create_source",
    "Add a new custom data source for crawling.",
    {
      sourceId: z
        .string()
        .min(1)
        .max(50)
        .describe("Unique ID (lowercase alphanumeric + hyphens)"),
      name: z.string().min(1).max(100).describe("Display name"),
      type: z
        .enum(["json", "csv", "xml", "ndjson"])
        .describe("Data format type"),
      url: z.string().url().describe("URL to fetch data from"),
      fieldMapping: z
        .record(z.string(), z.string())
        .optional()
        .describe("Map source fields to entity fields"),
      riskLevel: z
        .enum(["HIGH", "MEDIUM", "LOW"])
        .optional()
        .describe("Risk level (default HIGH)"),
      enabled: z
        .boolean()
        .optional()
        .describe("Enable immediately (default false)"),
    },
    async ({ sourceId, name, type, url, fieldMapping, riskLevel, enabled }) => {
      const auth = getAuth(server);
      requirePermission(auth, "admin:manage");

      try {
        validateExternalUrl(url);
      } catch (err) {
        const msg = err instanceof SsrfError ? err.message : "Invalid URL";
        return {
          content: [{ type: "text" as const, text: `Blocked: ${msg}` }],
          isError: true,
        };
      }

      const source = await createSource({
        sourceId,
        name,
        type,
        url,
        fieldMapping: fieldMapping ? JSON.stringify(fieldMapping) : undefined,
        riskLevel: riskLevel || "HIGH",
        enabled: enabled || false,
      });

      audit({
        action: "create_source",
        actor: auth.clientId,
        target: sourceId,
        detail: { name, type, url, riskLevel, enabled },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Created source "${source.name}" (${source.sourceId}), enabled: ${source.enabled}`,
          },
        ],
      };
    }
  );

  // --- update_source ---
  server.tool(
    "update_source",
    "Update an existing data source configuration.",
    {
      sourceId: z.string().describe("Source ID to update"),
      name: z.string().optional().describe("New display name"),
      enabled: z.boolean().optional().describe("Enable or disable"),
      url: z.string().url().optional().describe("New URL"),
      riskLevel: z
        .enum(["HIGH", "MEDIUM", "LOW"])
        .optional()
        .describe("New risk level"),
      fieldMapping: z
        .record(z.string(), z.string())
        .optional()
        .describe("New field mapping"),
    },
    async ({ sourceId, name, enabled, url, riskLevel, fieldMapping }) => {
      const auth = getAuth(server);
      requirePermission(auth, "admin:manage");

      if (url) {
        try {
          validateExternalUrl(url);
        } catch (err) {
          const msg = err instanceof SsrfError ? err.message : "Invalid URL";
          return {
            content: [{ type: "text" as const, text: `Blocked: ${msg}` }],
            isError: true,
          };
        }
      }

      const source = await getSourceBySourceId(sourceId);
      if (!source) {
        return {
          content: [
            { type: "text" as const, text: `Source not found: ${sourceId}` },
          ],
          isError: true,
        };
      }
      const updated = await updateSource(source.id, {
        name,
        enabled,
        url,
        riskLevel,
        fieldMapping: fieldMapping ? JSON.stringify(fieldMapping) : undefined,
      });
      if (!updated) {
        return {
          content: [
            { type: "text" as const, text: `Failed to update source: ${sourceId}` },
          ],
          isError: true,
        };
      }

      audit({
        action: "update_source",
        actor: auth.clientId,
        target: sourceId,
        detail: { name, enabled, url, riskLevel },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Updated source "${updated.name}" (${sourceId})`,
          },
        ],
      };
    }
  );

  // --- delete_source ---
  server.tool(
    "delete_source",
    "Delete a custom data source. Cannot delete built-in sources.",
    {
      sourceId: z.string().describe("Source ID to delete"),
    },
    async ({ sourceId }) => {
      const auth = getAuth(server);
      requirePermission(auth, "admin:manage");
      const source = await getSourceBySourceId(sourceId);
      if (!source) {
        return {
          content: [
            { type: "text" as const, text: `Source not found: ${sourceId}` },
          ],
          isError: true,
        };
      }
      if (source.type === "builtin") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Cannot delete built-in source: ${sourceId}`,
            },
          ],
          isError: true,
        };
      }
      await deleteSource(source.id);

      audit({
        action: "delete_source",
        actor: auth.clientId,
        target: sourceId,
      });

      return {
        content: [
          { type: "text" as const, text: `Deleted source: ${sourceId}` },
        ],
      };
    }
  );

  // --- test_source ---
  server.tool(
    "test_source",
    "Test-fetch a data source to validate its configuration.",
    {
      sourceId: z.string().describe("Source ID to test"),
    },
    async ({ sourceId }) => {
      requirePermission(getAuth(server), "admin:manage");
      const crawler = await getCrawlerBySourceId(sourceId);
      if (!crawler) {
        return {
          content: [
            { type: "text" as const, text: `No crawler found for source: ${sourceId}` },
          ],
          isError: true,
        };
      }
      try {
        const rawEntities = await crawler.fetch();
        const normalized = crawler.normalize(rawEntities);
        return {
          content: [
            {
              type: "text" as const,
              text: `Test OK for "${sourceId}": fetched ${rawEntities.length} raw entities, normalized to ${normalized.length} entities.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Test FAILED for "${sourceId}": ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- trigger_crawl ---
  server.tool(
    "trigger_crawl",
    "Manually trigger a data crawl. Omit sourceId to crawl all enabled sources.",
    {
      sourceId: z
        .string()
        .optional()
        .describe("Source ID to crawl (omit for all enabled)"),
    },
    async ({ sourceId }) => {
      const auth = getAuth(server);
      requirePermission(auth, "admin:manage");

      audit({
        action: "trigger_crawl",
        actor: auth.clientId,
        target: sourceId ?? "all",
      });

      if (sourceId) {
        const crawler = await getCrawlerBySourceId(sourceId);
        if (!crawler) {
          return {
            content: [
              { type: "text" as const, text: `No crawler found for source: ${sourceId}` },
            ],
            isError: true,
          };
        }
        const result = await runCrawlerPipeline(crawler);
        return {
          content: [
            {
              type: "text" as const,
              text: `Crawl complete for "${sourceId}": ${result.recordCount} records, ${result.errors.length} errors.${result.errors.length > 0 ? `\nErrors:\n${result.errors.join("\n")}` : ""}`,
            },
          ],
        };
      }
      // Crawl all enabled
      const crawlers = await getActiveCrawlers();
      const results = [];
      for (const crawler of crawlers) {
        const result = await runCrawlerPipeline(crawler);
        results.push(result);
      }
      const summary = results
        .map(
          (r) =>
            `- ${r.source}: ${r.recordCount} records, ${r.errors.length} errors`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Crawl complete for ${results.length} sources:\n${summary}`,
          },
        ],
      };
    }
  );

  // --- get_crawl_status (with UI) ---
  const crawlStatusUri = "ui://crawl-status/mcp-app.html";

  registerAppTool(
    server,
    "get_crawl_status",
    {
      title: "Crawl Status",
      description: "View crawl history, errors, and timing across sources.",
      inputSchema: {
        sourceId: z
          .string()
          .optional()
          .describe("Filter by source ID (omit for all)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max records to return (default 20)"),
      },
      _meta: { ui: { resourceUri: crawlStatusUri } },
    },
    async ({ sourceId, limit }) => {
      requirePermission(getAuth(server), "admin:manage");
      const driver = getDriver();
      const session = driver.session();
      try {
        const query = buildDataStatusQuery();
        const result = await session.run(query.cypher, query.params);
        let rows = result.records.map((r) => {
          const latest = r.get("latest");
          if (!latest) {
            return {
              source: r.get("source") as string,
              status: "unknown",
              recordCount: 0,
              date: "never",
            };
          }
          const props = latest.properties;
          return {
            source: r.get("source") as string,
            status: props.status as string,
            recordCount: typeof props.recordCount?.toNumber === "function"
              ? (props.recordCount.toNumber() as number)
              : Number(props.recordCount || 0),
            date: props.date as string,
            completedAt: props.completedAt as string | undefined,
            error: props.error as string | undefined,
          };
        });
        if (sourceId) {
          rows = rows.filter((r) => r.source === sourceId);
        }
        rows = rows.slice(0, limit || 20);
        return {
          content: [
            { type: "text" as const, text: formatCrawlStatus(rows) },
          ],
          structuredContent: { sourceId, rows },
        };
      } finally {
        await session.close();
      }
    }
  );

  registerAppResource(server, crawlStatusUri, crawlStatusUri, {
    mimeType: RESOURCE_MIME_TYPE,
  }, async () => ({
    contents: [
      { uri: crawlStatusUri, mimeType: RESOURCE_MIME_TYPE, text: await readUiHtml("crawl-status") },
    ],
  }));

  // --- get_matching_config ---
  server.tool(
    "get_matching_config",
    "View the current fuzzy matching algorithm weights and threshold.",
    {},
    async () => {
      requirePermission(getAuth(server), "admin:manage");
      return {
        content: [
          { type: "text" as const, text: formatMatchingConfig(matchingConfig) },
        ],
      };
    }
  );

  // --- update_matching_config ---
  server.tool(
    "update_matching_config",
    "Adjust fuzzy matching algorithm weights and minimum score threshold.",
    {
      minScore: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum match score (0-1)"),
      levenshtein: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Levenshtein weight"),
      jaroWinkler: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Jaro-Winkler weight"),
      metaphone: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Metaphone weight"),
      tokenSet: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Token Set weight"),
    },
    async ({ minScore, levenshtein, jaroWinkler, metaphone, tokenSet }) => {
      const auth = getAuth(server);
      requirePermission(auth, "admin:manage");
      if (minScore !== undefined) matchingConfig.minScore = minScore;
      if (levenshtein !== undefined)
        matchingConfig.weights.levenshtein = levenshtein;
      if (jaroWinkler !== undefined)
        matchingConfig.weights.jaroWinkler = jaroWinkler;
      if (metaphone !== undefined) matchingConfig.weights.metaphone = metaphone;
      if (tokenSet !== undefined) matchingConfig.weights.tokenSet = tokenSet;

      audit({
        action: "update_matching_config",
        actor: auth.clientId,
        detail: { minScore, levenshtein, jaroWinkler, metaphone, tokenSet },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Matching config updated.\n${formatMatchingConfig(matchingConfig)}`,
          },
        ],
      };
    }
  );
}
