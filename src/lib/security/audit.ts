// src/lib/security/audit.ts
// Structured audit log for admin actions. Writes to stderr in JSON format
// so it can be ingested by log aggregators (ELK, Datadog, CloudWatch, etc.).

export interface AuditEntry {
  action: string;
  actor: string;
  target?: string;
  detail?: Record<string, unknown>;
}

/**
 * Emits a structured audit log line to stderr.
 * Each line is a self-contained JSON object for easy parsing.
 */
export function audit(entry: AuditEntry): void {
  const record = {
    timestamp: new Date().toISOString(),
    level: 'AUDIT',
    action: entry.action,
    actor: entry.actor,
    ...(entry.target && { target: entry.target }),
    ...(entry.detail && { detail: entry.detail }),
  };
  process.stderr.write(JSON.stringify(record) + '\n');
}
