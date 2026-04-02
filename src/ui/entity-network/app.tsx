import { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

interface NetworkNode {
  id: string;
  name: string;
  labels: string[];
  relationships: { type: string }[];
}

interface NetworkData {
  entityId: string;
  depth: number;
  network: NetworkNode[];
}

const REL_COLORS: Record<string, string> = {
  FAMILY_OF: "#ef4444",
  ASSOCIATE_OF: "#f59e0b",
  DIRECTOR_OF: "#3b82f6",
  BENEFICIAL_OWNER_OF: "#8b5cf6",
  SUBSIDIARY_OF: "#06b6d4",
};

function EntityNetwork() {
  const [data, setData] = useState<NetworkData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useApp({
    appInfo: { name: "entity-network", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        if (result.structuredContent) {
          setData(result.structuredContent as unknown as NetworkData);
        }
      };
    },
  });

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const width = (canvas.width = canvas.parentElement!.clientWidth);
    const height = (canvas.height = 400);
    const centerX = width / 2;
    const centerY = height / 2;

    // Build graph
    const nodes: {
      id: string;
      name: string;
      x: number;
      y: number;
      isCenter: boolean;
    }[] = [];
    const edges: { sourceId: string; targetId: string; type: string }[] = [];
    const nodeMap = new Map<string, (typeof nodes)[0]>();

    // Center node
    const center = {
      id: data.entityId,
      name: data.network[0]?.name || data.entityId,
      x: centerX,
      y: centerY,
      isCenter: true,
    };
    nodes.push(center);
    nodeMap.set(center.id, center);

    // Connected nodes in circle
    const connected = data.network.filter((n) => n.id !== data.entityId);
    connected.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / connected.length;
      const radius = Math.min(width, height) * 0.35;
      const node = {
        id: n.id,
        name: n.name,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        isCenter: false,
      };
      nodes.push(node);
      nodeMap.set(n.id, node);
      n.relationships.forEach((r) => {
        edges.push({ sourceId: data.entityId, targetId: n.id, type: r.type });
      });
    });

    // Draw
    ctx.clearRect(0, 0, width, height);

    // Edges
    for (const edge of edges) {
      const s = nodeMap.get(edge.sourceId);
      const t = nodeMap.get(edge.targetId);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = REL_COLORS[edge.type] || "#9ca3af";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "center";
      ctx.fillText(edge.type.replace(/_/g, " "), mx, my - 4);
    }

    // Nodes
    for (const node of nodes) {
      const r = node.isCenter ? 20 : 14;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.isCenter ? "#2563eb" : "#e5e7eb";
      ctx.fill();
      ctx.strokeStyle = node.isCenter ? "#1d4ed8" : "#9ca3af";
      ctx.lineWidth = 2;
      ctx.stroke();

      const maxLen = 15;
      const displayName =
        node.name.length > maxLen
          ? node.name.slice(0, maxLen) + "..."
          : node.name;

      ctx.font = node.isCenter ? "bold 12px sans-serif" : "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (node.isCenter) {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(displayName, node.x, node.y);
      } else {
        ctx.fillStyle = "#111827";
        ctx.fillText(displayName, node.x, node.y + r + 14);
      }
    }
  }, [data]);

  if (!data) {
    return <div className="empty-state">Loading network graph...</div>;
  }

  const relTypes = new Set(
    data.network.flatMap((n) => n.relationships.map((r) => r.type)),
  );

  return (
    <div>
      <div className="header">
        <h2>Entity Network</h2>
        <p>
          {data.network.length} entities | depth: {data.depth}
        </p>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      />
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {Array.from(relTypes).map((type) => (
          <div
            key={type}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: REL_COLORS[type] || "#9ca3af",
                display: "inline-block",
              }}
            />
            {type.replace(/_/g, " ")}
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<EntityNetwork />);
