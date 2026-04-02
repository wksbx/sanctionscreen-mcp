// src/tools/user-tools.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

import { screenPerson, screenCompany } from "../lib/matching/matcher.js";
import { getDriver } from "../lib/neo4j/client.js";
import {
  buildEntityDetailQuery,
  buildEntityNetworkQuery,
  buildDataStatusQuery,
} from "../lib/neo4j/queries.js";
import type { AuthInfo } from "../lib/auth/permissions.js";
import { requirePermission } from "../lib/auth/permissions.js";
import {
  formatScreenResults,
  formatEntityDetail,
  formatNetworkSummary,
  formatDataStatus,
  formatSourceCoverage,
} from "./formatters.js";

const DIST_UI = path.join(process.cwd(), "dist", "ui");

function getAuth(server: McpServer): AuthInfo {
  return (server as McpServer & { authInfo: AuthInfo }).authInfo;
}

async function readUiHtml(uiName: string): Promise<string> {
  return fs.readFile(path.join(DIST_UI, uiName, "index.html"), "utf-8");
}

export function registerUserTools(server: McpServer): void {
  // --- screen_person ---
  const screenPersonUri = "ui://screen-person/mcp-app.html";

  registerAppTool(
    server,
    "screen_person",
    {
      title: "Screen Person",
      description:
        "Fuzzy search for a person against PEP and sanctions lists. Returns matches with confidence scores.",
      inputSchema: {
        name: z.string().describe("Full name to search"),
        dob: z.string().optional().describe("Date of birth (YYYY-MM-DD)"),
        nationality: z
          .string()
          .optional()
          .describe("Nationality (ISO 2-letter code)"),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Minimum match score (0-1, default 0.6)"),
      },
      _meta: { ui: { resourceUri: screenPersonUri } },
    },
    async ({ name, dob, nationality, threshold }) => {
      requirePermission(getAuth(server), "screen:read");
      const results = await screenPerson({
        name,
        dob,
        nationality,
        threshold,
      });
      return {
        content: [{ type: "text" as const, text: formatScreenResults(results, name) }],
        structuredContent: { query: { name, dob, nationality, threshold }, results },
      };
    }
  );

  registerAppResource(server, screenPersonUri, screenPersonUri, {
    mimeType: RESOURCE_MIME_TYPE,
  }, async () => ({
    contents: [
      { uri: screenPersonUri, mimeType: RESOURCE_MIME_TYPE, text: await readUiHtml("screen-results") },
    ],
  }));

  // --- screen_company ---
  const screenCompanyUri = "ui://screen-company/mcp-app.html";

  registerAppTool(
    server,
    "screen_company",
    {
      title: "Screen Company",
      description:
        "Fuzzy search for a company against sanctions lists. Returns matches with confidence scores.",
      inputSchema: {
        name: z.string().describe("Company name to search"),
        jurisdiction: z
          .string()
          .optional()
          .describe("Jurisdiction (ISO 2-letter code)"),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Minimum match score (0-1, default 0.6)"),
      },
      _meta: { ui: { resourceUri: screenCompanyUri } },
    },
    async ({ name, jurisdiction, threshold }) => {
      requirePermission(getAuth(server), "screen:read");
      const results = await screenCompany({ name, jurisdiction, threshold });
      return {
        content: [{ type: "text" as const, text: formatScreenResults(results, name) }],
        structuredContent: { query: { name, jurisdiction, threshold }, results },
      };
    }
  );

  registerAppResource(server, screenCompanyUri, screenCompanyUri, {
    mimeType: RESOURCE_MIME_TYPE,
  }, async () => ({
    contents: [
      { uri: screenCompanyUri, mimeType: RESOURCE_MIME_TYPE, text: await readUiHtml("screen-results") },
    ],
  }));

  // --- batch_screen ---
  const batchScreenUri = "ui://batch-screen/mcp-app.html";

  registerAppTool(
    server,
    "batch_screen",
    {
      title: "Batch Screen",
      description:
        "Screen multiple entities (up to 200) against PEP and sanctions lists.",
      inputSchema: {
        entities: z
          .array(
            z.object({
              name: z.string(),
              type: z.enum(["person", "company"]),
              dob: z.string().optional(),
              nationality: z.string().optional(),
            })
          )
          .min(1)
          .max(200)
          .describe("Entities to screen"),
      },
      _meta: { ui: { resourceUri: batchScreenUri } },
    },
    async ({ entities }) => {
      requirePermission(getAuth(server), "screen:read");
      const allResults = [];
      for (const entity of entities) {
        const results =
          entity.type === "person"
            ? await screenPerson({
                name: entity.name,
                dob: entity.dob,
                nationality: entity.nationality,
              })
            : await screenCompany({ name: entity.name });
        allResults.push({ entity, results });
      }
      const textParts = allResults.map(
        ({ entity, results }) =>
          `\n### ${entity.name} (${entity.type})\n${formatScreenResults(results, entity.name)}`
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Batch screening: ${entities.length} entities\n${textParts.join("\n")}`,
          },
        ],
        structuredContent: { entities, allResults },
      };
    }
  );

  registerAppResource(server, batchScreenUri, batchScreenUri, {
    mimeType: RESOURCE_MIME_TYPE,
  }, async () => ({
    contents: [
      { uri: batchScreenUri, mimeType: RESOURCE_MIME_TYPE, text: await readUiHtml("batch-results") },
    ],
  }));

  // --- get_entity_details ---
  const entityDetailsUri = "ui://entity-details/mcp-app.html";

  registerAppTool(
    server,
    "get_entity_details",
    {
      title: "Entity Details",
      description:
        "Get the full profile of an entity including aliases, sanctions lists, and relationships.",
      inputSchema: {
        entityId: z.string().describe("Entity ID from screening results"),
      },
      _meta: { ui: { resourceUri: entityDetailsUri } },
    },
    async ({ entityId }) => {
      requirePermission(getAuth(server), "screen:read");
      const driver = getDriver();
      const session = driver.session();
      try {
        const query = buildEntityDetailQuery(entityId);
        const result = await session.run(query.cypher, query.params);
        if (result.records.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No entity found with ID: ${entityId}` }],
          };
        }
        const record = result.records[0];
        const entity = record.get("entity").properties;
        const relationships = record.has("relationships")
          ? record.get("relationships")
          : [];
        const sanctions = record.has("sanctions")
          ? record.get("sanctions")
          : [];
        const countries = record.has("countries")
          ? record.get("countries")
          : [];

        const detail = {
          id: entity.id,
          fullName: entity.fullName || entity.name,
          aliases: entity.aliases || [],
          dateOfBirth: entity.dateOfBirth,
          nationality: countries.map((c: { name: string }) => c.name),
          pepRole: entity.pepRole,
          sanctionsList: sanctions.map((s: { name: string }) => s.name),
          relationships,
        };

        return {
          content: [{ type: "text" as const, text: formatEntityDetail(detail) }],
          structuredContent: detail,
        };
      } finally {
        await session.close();
      }
    }
  );

  registerAppResource(server, entityDetailsUri, entityDetailsUri, {
    mimeType: RESOURCE_MIME_TYPE,
  }, async () => ({
    contents: [
      { uri: entityDetailsUri, mimeType: RESOURCE_MIME_TYPE, text: await readUiHtml("entity-details") },
    ],
  }));

  // --- get_entity_network ---
  const entityNetworkUri = "ui://entity-network/mcp-app.html";

  registerAppTool(
    server,
    "get_entity_network",
    {
      title: "Entity Network",
      description:
        "Traverse the relationship graph around an entity to discover connections.",
      inputSchema: {
        entityId: z.string().describe("Entity ID"),
        depth: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("Traversal depth (1-4, default 2)"),
      },
      _meta: { ui: { resourceUri: entityNetworkUri } },
    },
    async ({ entityId, depth }) => {
      requirePermission(getAuth(server), "screen:read");
      const driver = getDriver();
      const session = driver.session();
      try {
        const query = buildEntityNetworkQuery(entityId, depth || 2);
        const result = await session.run(query.cypher, query.params);
        const network = result.records.map((r) => ({
          id: r.get("id"),
          name: r.get("name"),
          labels: r.get("labels"),
          relationships: r.get("relationships"),
        }));
        const entityName = network.length > 0 ? network[0].name : entityId;
        return {
          content: [
            {
              type: "text" as const,
              text: formatNetworkSummary(entityId, entityName, network),
            },
          ],
          structuredContent: { entityId, depth: depth || 2, network },
        };
      } finally {
        await session.close();
      }
    }
  );

  registerAppResource(server, entityNetworkUri, entityNetworkUri, {
    mimeType: RESOURCE_MIME_TYPE,
  }, async () => ({
    contents: [
      { uri: entityNetworkUri, mimeType: RESOURCE_MIME_TYPE, text: await readUiHtml("entity-network") },
    ],
  }));

  // --- get_source_coverage (text-only) ---
  server.tool(
    "get_source_coverage",
    "View which data sources are active, their last successful crawl, and error counts.",
    {
      sourceName: z
        .string()
        .optional()
        .describe("Filter by source name (omit for all)"),
    },
    async ({ sourceName }) => {
      requirePermission(getAuth(server), "screen:read");
      const driver = getDriver();
      const session = driver.session();
      try {
        const query = buildDataStatusQuery();
        const result = await session.run(query.cypher, query.params);
        const rows = result.records.map((r) => {
          const latest = r.get("latest").properties;
          return {
            source: r.get("source") as string,
            status: latest.status as string,
            recordCount: typeof latest.recordCount === "object" && "toNumber" in latest.recordCount
              ? (latest.recordCount as { toNumber(): number }).toNumber()
              : (latest.recordCount as number),
            date: latest.date as string,
            completedAt: latest.completedAt as string | undefined,
            error: latest.error as string | undefined,
          };
        });
        const filtered = sourceName
          ? rows.filter((r) =>
              r.source.toLowerCase().includes(sourceName.toLowerCase())
            )
          : rows;
        return {
          content: [
            { type: "text" as const, text: formatSourceCoverage(filtered, sourceName) },
          ],
        };
      } finally {
        await session.close();
      }
    }
  );

  // --- get_data_status (text-only) ---
  server.tool(
    "get_data_status",
    "View overall data freshness — last crawl time and record count per source.",
    {},
    async () => {
      requirePermission(getAuth(server), "screen:read");
      const driver = getDriver();
      const session = driver.session();
      try {
        const query = buildDataStatusQuery();
        const result = await session.run(query.cypher, query.params);
        const status = result.records.map((r) => {
          const latest = r.get("latest").properties;
          return {
            source: r.get("source") as string,
            status: latest.status as string,
            recordCount: typeof latest.recordCount === "object" && "toNumber" in latest.recordCount
              ? (latest.recordCount as { toNumber(): number }).toNumber()
              : (latest.recordCount as number),
            date: latest.date as string,
            completedAt: latest.completedAt as string | undefined,
            error: latest.error as string | undefined,
          };
        });
        return {
          content: [{ type: "text" as const, text: formatDataStatus(status) }],
        };
      } finally {
        await session.close();
      }
    }
  );
}
