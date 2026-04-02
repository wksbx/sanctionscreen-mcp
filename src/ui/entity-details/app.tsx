import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

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

function EntityDetails() {
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const { app } = useApp({
    appInfo: { name: "entity-details", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        if (result.structuredContent) {
          setEntity(result.structuredContent as unknown as EntityDetail);
        }
      };
    },
  });

  const viewNetwork = async () => {
    if (!entity || !app) return;
    setLoading(true);
    try {
      await app.callServerTool({
        name: "get_entity_network",
        arguments: { entityId: entity.id, depth: 2 },
      });
    } finally {
      setLoading(false);
    }
  };

  if (!entity) {
    return <div className="empty-state">Loading entity details...</div>;
  }

  return (
    <div>
      <div className="header">
        <h2>{entity.fullName}</h2>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          ID: {entity.id}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Section title="Identity">
          {entity.aliases.length > 0 && (
            <Field label="Aliases" value={entity.aliases.join(", ")} />
          )}
          {entity.dateOfBirth && (
            <Field label="Date of Birth" value={entity.dateOfBirth} />
          )}
          {entity.nationality.length > 0 && (
            <Field label="Nationality" value={entity.nationality.join(", ")} />
          )}
          {entity.pepRole && (
            <Field label="PEP Role" value={entity.pepRole} />
          )}
        </Section>

        <Section title="Sanctions Lists">
          {entity.sanctionsList.length > 0 ? (
            <ul style={{ paddingLeft: 16 }}>
              {entity.sanctionsList.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{s}</li>
              ))}
            </ul>
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>None</span>
          )}
        </Section>
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

      <div style={{ marginTop: 16 }}>
        <button onClick={viewNetwork} disabled={loading}>
          View Network Graph
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
      <h3 style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<EntityDetails />);
