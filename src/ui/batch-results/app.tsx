import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { scoreColor } from "../shared/utils.js";

interface MatchResult {
  entityId: string;
  fullName: string;
  score: number;
  entityType: string;
  pepRole?: string;
  sanctionsList: string[];
  linkedEntityCount: number;
}

interface BatchEntity {
  name: string;
  type: string;
  dob?: string;
  nationality?: string;
}

interface BatchData {
  entities: BatchEntity[];
  allResults: { entity: BatchEntity; results: MatchResult[] }[];
}

function BatchResults() {
  const [data, setData] = useState<BatchData | null>(null);
  const [filter, setFilter] = useState<"all" | "matches" | "clear">("all");

  useApp({
    appInfo: { name: "batch-results", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        if (result.structuredContent) {
          setData(result.structuredContent as unknown as BatchData);
        }
      };
    },
  });

  if (!data) {
    return <div className="empty-state">Loading batch results...</div>;
  }

  const filtered =
    filter === "matches"
      ? data.allResults.filter((r) => r.results.length > 0)
      : filter === "clear"
        ? data.allResults.filter((r) => r.results.length === 0)
        : data.allResults;

  const totalMatches = data.allResults.filter((r) => r.results.length > 0).length;

  return (
    <div>
      <div className="header">
        <h2>Batch Screening Results</h2>
        <p>
          {data.entities.length} entities screened | {totalMatches} with matches
        </p>
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        {(["all", "matches", "clear"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "var(--accent)" : undefined,
              color: filter === f ? "#fff" : undefined,
            }}
          >
            {f === "all"
              ? `All (${data.allResults.length})`
              : f === "matches"
                ? `Matches (${totalMatches})`
                : `Clear (${data.allResults.length - totalMatches})`}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Query</th>
            <th>Type</th>
            <th>Matches</th>
            <th>Top Score</th>
            <th>Top Match</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ entity, results }, i) => {
            const top = results[0];
            return (
              <tr key={i}>
                <td><strong>{entity.name}</strong></td>
                <td>{entity.type}</td>
                <td>{results.length}</td>
                <td>
                  {top ? (
                    <>
                      <span className="score-bar">
                        <span
                          className="score-bar-fill"
                          style={{
                            width: `${top.score * 100}%`,
                            background: scoreColor(top.score),
                          }}
                        />
                      </span>
                      {(top.score * 100).toFixed(0)}%
                    </>
                  ) : (
                    <span style={{ color: "var(--success)" }}>Clear</span>
                  )}
                </td>
                <td>{top?.fullName || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<BatchResults />);
