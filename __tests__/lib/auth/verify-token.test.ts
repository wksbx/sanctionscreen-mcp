import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jose before importing the module under test
vi.mock("jose", () => {
  const JWTExpired = class extends Error {
    constructor() {
      super("JWT expired");
      this.name = "JWTExpired";
    }
  };
  const JWSSignatureVerificationFailed = class extends Error {
    constructor() {
      super("signature verification failed");
      this.name = "JWSSignatureVerificationFailed";
    }
  };

  return {
    createRemoteJWKSet: vi.fn(() => "mock-jwks"),
    jwtVerify: vi.fn(),
    errors: { JWTExpired, JWSSignatureVerificationFailed },
  };
});

// Mock the logger to suppress output during tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { verifyToken } from "@/lib/auth/verify-token";
import * as jose from "jose";

const mockJwtVerify = jose.jwtVerify as ReturnType<typeof vi.fn>;

describe("verifyToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH0_ISSUER_BASE_URL = "https://test.auth0.com";
    process.env.AUTH0_AUDIENCE = "https://test-api";
  });

  it("returns null for undefined token", async () => {
    const result = await verifyToken(undefined);
    expect(result).toBeNull();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("returns null for empty string token", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  it("returns auth info for valid token", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        azp: "client-123",
        permissions: ["screen:read", "admin:manage"],
      },
    });

    const result = await verifyToken("valid-token");
    expect(result).toEqual({
      clientId: "client-123",
      permissions: ["screen:read", "admin:manage"],
    });
  });

  it("falls back to sub when azp is missing", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: "user-456",
        permissions: ["screen:read"],
      },
    });

    const result = await verifyToken("valid-token");
    expect(result).toEqual({
      clientId: "user-456",
      permissions: ["screen:read"],
    });
  });

  it("defaults to empty permissions array", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: "user-789" },
    });

    const result = await verifyToken("valid-token");
    expect(result).toEqual({
      clientId: "user-789",
      permissions: [],
    });
  });

  it("returns null on expired JWT", async () => {
    mockJwtVerify.mockRejectedValueOnce(new jose.errors.JWTExpired());

    const result = await verifyToken("expired-token");
    expect(result).toBeNull();
  });

  it("returns null on signature verification failure", async () => {
    mockJwtVerify.mockRejectedValueOnce(
      new jose.errors.JWSSignatureVerificationFailed()
    );

    const result = await verifyToken("bad-sig-token");
    expect(result).toBeNull();
  });

  it("returns null on unknown verification error", async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error("network error"));

    const result = await verifyToken("some-token");
    expect(result).toBeNull();
  });

  it("returns null when AUTH0_ISSUER_BASE_URL is not set", async () => {
    delete process.env.AUTH0_ISSUER_BASE_URL;

    const result = await verifyToken("some-token");
    expect(result).toBeNull();
  });
});
