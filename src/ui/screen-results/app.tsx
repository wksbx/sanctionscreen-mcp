import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { scoreColor, truncate } from "../shared/utils.js";

interface MatchResult {
  entityId: string;
  fullName: string;
  score: number;
  matchedField: string;
  entityType: string;
  pepRole?: string;
  sanctionsList: string[];
  nationality?: string;
  linkedEntityCount: number;
}

interface ScreenData {
  query: { name: string; dob?: string; nationality?: string };
  results: MatchResult[];
}

interface EntityDetail {
  id: string;
  fullName: string;
  aliases: string[];
  dateOfBirth?: string;
  nationality: string[];
  pepRole?: string;
  sanctionsList: string[];
  relationships: {
    type: string;
    targetName: string;
    relation?: string;
    context?: string;
  }[];
}

function ScreenResults() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const { app } = useApp({
    appInfo: { name: "screen-results", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        if (result.structuredContent) {
          setData(result.structuredContent as unknown as ScreenData);
        }
      };
    },
  });

  const viewDetails = async (entityId: string) => {
    if (!app) return;
    setLoading(true);
    try {
      const result = await app.callServerTool({
        name: "get_entity_details",
        arguments: { entityId },
      });
      if (result.structuredContent) {
        setEntity(result.structuredContent as unknown as EntityDetail);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return <div className="empty-state">Waiting for screening results...</div>;
  }

  // Entity detail view
  if (entity) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setEntity(null)}>&larr; Back to results</button>
        </div>
        <div className="header">
          <h2>{entity.fullName}</h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>ID: {entity.id}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <h3 style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Identity</h3>
            {entity.aliases.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Aliases: </span>
                <span>{entity.aliases.join(", ")}</span>
              </div>
            )}
            {entity.dateOfBirth && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>DOB: </span>
                <span>{entity.dateOfBirth}</span>
              </div>
            )}
            {entity.nationality.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nationality: </span>
                <span>{entity.nationality.join(", ")}</span>
              </div>
            )}
            {entity.pepRole && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>PEP Role: </span>
                <span>{entity.pepRole}</span>
              </div>
            )}
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <h3 style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Sanctions Lists</h3>
            {entity.sanctionsList.length > 0 ? (
              <ul style={{ paddingLeft: 16 }}>
                {entity.sanctionsList.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                ))}
              </ul>
            ) : (
              <span style={{ color: "var(--text-secondary)" }}>None</span>
            )}
          </div>
        </div>

        {entity.relationships.length > 0 && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>
              Relationships ({entity.relationships.length})
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Relation</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                {entity.relationships.map((r, i) => (
                  <tr key={i}>
                    <td>{r.type.replace(/_/g, " ")}</td>
                    <td>{r.targetName}</td>
                    <td>{r.relation || "-"}</td>
                    <td>{r.context || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Results list view
  const { query, results } = data;

  return (
    <div>
      <div className="header">
        <h2>Screening Results</h2>
        <p>
          Query: <strong>{query.name}</strong>
          {query.dob && <> | DOB: {query.dob}</>}
          {query.nationality && <> | Nationality: {query.nationality}</>}
          {" "} | {results.length} match{results.length !== 1 ? "es" : ""}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">No matches found.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Score</th>
              <th>Type</th>
              <th>Role / Lists</th>
              <th>Links</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.entityId}>
                <td>
                  <strong>{r.fullName}</strong>
                  {r.nationality && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {r.nationality}
                    </div>
                  )}
                </td>
                <td>
                  <span className="score-bar">
                    <span
                      className="score-bar-fill"
                      style={{
                        width: `${r.score * 100}%`,
                        background: scoreColor(r.score),
                      }}
                    />
                  </span>
                  {(r.score * 100).toFixed(0)}%
                </td>
                <td>{r.entityType}</td>
                <td>
                  {r.pepRole && <div>{r.pepRole}</div>}
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {truncate(r.sanctionsList.join(", "), 40)}
                  </div>
                </td>
                <td>{r.linkedEntityCount}</td>
                <td>
                  <button onClick={() => viewDetails(r.entityId)} disabled={loading}>
                    {loading ? "..." : "Details"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<ScreenResults />);
