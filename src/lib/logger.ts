const isStdio = process.argv.includes("--stdio");

function formatMessage(level: string, msg: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `${timestamp} [${level}] ${msg}`;
  return meta !== undefined ? `${base} ${JSON.stringify(meta)}` : base;
}

export const logger = {
  info(msg: string, meta?: unknown): void {
    const out = isStdio ? process.stderr : process.stdout;
    out.write(formatMessage("INFO", msg, meta) + "\n");
  },
  warn(msg: string, meta?: unknown): void {
    process.stderr.write(formatMessage("WARN", msg, meta) + "\n");
  },
  error(msg: string, meta?: unknown): void {
    process.stderr.write(formatMessage("ERROR", msg, meta) + "\n");
  },
};
