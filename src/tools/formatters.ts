// src/tools/formatters.ts
import type { MatchResult } from "../lib/types.js";

export function formatScreenResults(results: MatchResult[], query: string): string {
  if (results.length === 0) return `No matches found for "${query}".`;
  const lines = results.map((r, i) => {
    const parts = [
      `${i + 1}. **${r.fullName}** (${(r.score * 100).toFixed(0)}% match)`,
      `   Type: ${r.entityType}`,
    ];
    if (r.pepRole) parts.push(`   Role: ${r.pepRole}`);
    if (r.sanctionsList.length > 0) parts.push(`   Lists: ${r.sanctionsList.join(", ")}`);
    if (r.nationality) parts.push(`   Nationality: ${r.nationality}`);
    parts.push(`   Linked entities: ${r.linkedEntityCount}`);
    parts.push(`   ID: ${r.entityId}`);
    return parts.join("\n");
  });
  return `Found ${results.length} match${results.length !== 1 ? "es" : ""} for "${query}":\n\n${lines.join("\n\n")}`;
}

export function formatEntityDetail(entity: {
  id: string;
  fullName: string;
  aliases?: string[];
  dateOfBirth?: string;
  nationality?: string[];
  pepRole?: string;
  sanctionsList?: string[];
  relationships?: { type: string; targetName: string; relation?: string; context?: string }[];
}): string {
  const parts = [`**${entity.fullName}** (${entity.id})`];
  if (entity.aliases && entity.aliases.length > 0) parts.push(`Aliases: ${entity.aliases.join(", ")}`);
  if (entity.dateOfBirth) parts.push(`Date of Birth: ${entity.dateOfBirth}`);
  if (entity.nationality && entity.nationality.length > 0) parts.push(`Nationality: ${entity.nationality.join(", ")}`);
  if (entity.pepRole) parts.push(`PEP Role: ${entity.pepRole}`);
  if (entity.sanctionsList && entity.sanctionsList.length > 0) parts.push(`Sanctions Lists: ${entity.sanctionsList.join(", ")}`);
  if (entity.relationships && entity.relationships.length > 0) {
    parts.push(`\nRelationships (${entity.relationships.length}):`);
    for (const rel of entity.relationships) {
      const detail = rel.relation ? ` (${rel.relation})` : "";
      parts.push(`  - ${rel.type.replace(/_/g, " ")}: ${rel.targetName}${detail}`);
    }
  }
  return parts.join("\n");
}

export function formatNetworkSummary(
  entityId: string,
  entityName: string,
  network: { id: string; name: string; labels: string[]; relationships: { type: string }[] }[]
): string {
  if (network.length === 0) return `No network found for entity ${entityId}.`;
  const typeCounts: Record<string, number> = {};
  for (const node of network) {
    for (const rel of node.relationships) {
      typeCounts[rel.type] = (typeCounts[rel.type] || 0) + 1;
    }
  }
  const parts = [`Network for **${entityName}** (${entityId}): ${network.length} connected entities`];
  parts.push("\nBy relationship type:");
  for (const [type, count] of Object.entries(typeCounts)) {
    parts.push(`  - ${type.replace(/_/g, " ")}: ${count}`);
  }
  const maxShow = 20;
  parts.push("\nConnected entities:");
  for (const node of network.slice(0, maxShow)) {
    parts.push(`  - ${node.name} (${node.labels.join(", ")})`);
  }
  if (network.length > maxShow) {
    parts.push(`  ... and ${network.length - maxShow} more`);
  }
  return parts.join("\n");
}

export function formatDataStatus(
  status: { source: string; status: string; recordCount: number; date: string; completedAt?: string; error?: string }[]
): string {
  if (status.length === 0) return "No data status available.";
  const lines = status.map((r) => {
    const s = r.status === "success" ? "OK" : "FAIL";
    const error = r.error ? ` | Error: ${r.error}` : "";
    return `- **${r.source}**: ${s} | ${r.recordCount} records | Last: ${r.date}${error}`;
  });
  return `Data Source Status:\n${lines.join("\n")}`;
}

export function formatSourceCoverage(
  rows: { source: string; status: string; recordCount: number; date: string; error?: string }[],
  sourceName?: string
): string {
  if (rows.length === 0) {
    return sourceName
      ? `No data found for source: ${sourceName}`
      : "No crawl data available.";
  }
  const header = sourceName
    ? `Source coverage for "${sourceName}":`
    : "Source Coverage:";
  const lines = rows.map((r) => {
    const status = r.status === "success" ? "OK" : "FAIL";
    const error = r.error ? ` | Error: ${r.error}` : "";
    return `- **${r.source}**: ${status} | ${r.recordCount} records | Last: ${r.date}${error}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

export function formatSourceList(
  sources: { sourceId: string; name: string; type: string; enabled: boolean; url?: string; riskLevel?: string }[]
): string {
  if (sources.length === 0) return "No data sources configured.";
  const lines = sources.map(
    (s) =>
      `- **${s.name}** (${s.sourceId}) | type: ${s.type} | ${s.enabled ? "enabled" : "disabled"} | risk: ${s.riskLevel || "HIGH"}`
  );
  return `Data Sources (${sources.length}):\n${lines.join("\n")}`;
}

export function formatCrawlStatus(
  rows: { source: string; status: string; recordCount: number; date: string; completedAt?: string; error?: string }[]
): string {
  if (rows.length === 0) return "No crawl history available.";
  const lines = rows.map((r) => {
    const status = r.status === "success" ? "OK" : "FAIL";
    const error = r.error ? ` | Error: ${r.error}` : "";
    return `- **${r.source}**: ${status} | ${r.recordCount} records | ${r.date}${error}`;
  });
  return `Crawl Status:\n${lines.join("\n")}`;
}

export function formatMatchingConfig(config: {
  minScore: number;
  weights: { levenshtein: number; jaroWinkler: number; metaphone: number; tokenSet: number };
}): string {
  return [
    "Matching Configuration:",
    `  Min Score: ${config.minScore}`,
    `  Weights:`,
    `    Levenshtein: ${config.weights.levenshtein}`,
    `    Jaro-Winkler: ${config.weights.jaroWinkler}`,
    `    Metaphone:    ${config.weights.metaphone}`,
    `    Token Set:    ${config.weights.tokenSet}`,
  ].join("\n");
}
