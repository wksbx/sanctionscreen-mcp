import { describe, it, expect } from "vitest";
import { requirePermission, type AuthInfo } from "@/lib/auth/permissions";

describe("requirePermission", () => {
  const adminAuth: AuthInfo = {
    clientId: "test-client",
    permissions: ["screen:read", "admin:manage"],
  };

  const userAuth: AuthInfo = {
    clientId: "test-user",
    permissions: ["screen:read"],
  };

  const emptyAuth: AuthInfo = {
    clientId: "no-perms",
    permissions: [],
  };

  it("allows when permission is present", () => {
    expect(() => requirePermission(adminAuth, "screen:read")).not.toThrow();
    expect(() => requirePermission(adminAuth, "admin:manage")).not.toThrow();
    expect(() => requirePermission(userAuth, "screen:read")).not.toThrow();
  });

  it("throws when permission is missing", () => {
    expect(() => requirePermission(userAuth, "admin:manage")).toThrow(
      /missing required permission 'admin:manage'/
    );
  });

  it("throws when permissions array is empty", () => {
    expect(() => requirePermission(emptyAuth, "screen:read")).toThrow(
      /missing required permission/
    );
  });
});
