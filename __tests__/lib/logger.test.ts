import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it("info writes structured output", async () => {
    const { logger } = await import("@/lib/logger");
    logger.info("test message");
    const output = stderrWrite.mock.calls.length > 0
      ? (stderrWrite.mock.calls[0][0] as string)
      : (stdoutWrite.mock.calls[0][0] as string);
    expect(output).toContain("[INFO]");
    expect(output).toContain("test message");
  });

  it("warn writes to stderr", async () => {
    const { logger } = await import("@/lib/logger");
    logger.warn("warning message");
    const output = stderrWrite.mock.calls[0][0] as string;
    expect(output).toContain("[WARN]");
    expect(output).toContain("warning message");
  });

  it("error writes to stderr with metadata", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("error message", { code: 500 });
    const output = stderrWrite.mock.calls[0][0] as string;
    expect(output).toContain("[ERROR]");
    expect(output).toContain("error message");
    expect(output).toContain("500");
  });
});
