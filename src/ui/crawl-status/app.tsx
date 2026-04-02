import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

interface CrawlRow {
  source: string;
  status: string;
  recordCount: number;
  date: string;
  completedAt?: string;
  error?: string;
}

interface CrawlData {
  sourceId?: string;
  rows: CrawlRow[];
}

function CrawlStatus() {
  const [data, setData] = useState<CrawlData | null>(null);

  useApp({
    appInfo: { name: "crawl-status", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        if (result.structuredContent) {
          setData(result.structuredContent as unknown as CrawlData);
        }
      };
    },
  });

  if (!data) {
    return <div className="empty-state">Loading crawl status...</div>;
  }

  const successCount = data.rows.filter((r) => r.status === "success").length;
  const failCount = data.rows.filter((r) => r.status === "failed").length;

  return (
    <div>
      <div className="header">
        <h2>Crawl Status</h2>
        <p>
          {data.rows.length} runs
          {data.sourceId && <> for <strong>{data.sourceId}</strong></>}
          {" | "}
          <span style={{ color: "var(--success)" }}>{successCount} OK</span>
          {failCount > 0 && (
            <>
              {" | "}
              <span style={{ color: "var(--danger)" }}>{failCount} failed</span>
            </>
          )}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Status</th>
            <th>Records</th>
            <th>Date</th>
            <th>Completed</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              <td><strong>{row.source}</strong></td>
              <td>
                <span
                  className="badge"
                  style={{
                    background:
                      row.status === "success"
                        ? "#f0fdf4"
                        : row.status === "failed"
                          ? "#fef2f2"
                          : "#fffbeb",
                    color:
                      row.status === "success"
                        ? "var(--success)"
                        : row.status === "failed"
                          ? "var(--danger)"
                          : "var(--warning)",
                  }}
                >
                  {row.status}
                </span>
              </td>
              <td>{row.recordCount.toLocaleString()}</td>
              <td>{row.date}</td>
              <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {row.completedAt || "-"}
              </td>
              <td style={{ fontSize: 12, color: "var(--danger)" }}>
                {row.error || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<CrawlStatus />);
