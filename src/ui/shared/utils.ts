export function scoreColor(score: number): string {
  if (score >= 0.8) return "#dc2626";
  if (score >= 0.6) return "#f59e0b";
  return "#16a34a";
}

export function riskBadgeClass(risk?: string): string {
  switch (risk?.toUpperCase()) {
    case "HIGH": return "badge badge-high";
    case "MEDIUM": return "badge badge-medium";
    case "LOW": return "badge badge-low";
    default: return "badge";
  }
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
