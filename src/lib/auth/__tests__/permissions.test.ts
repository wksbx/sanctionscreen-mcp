import { describe, it, expect } from "vitest";
import { requirePermission, type AuthInfo } from "../permissions.js";

describe("requirePermission", () => {
  const adminAuth: AuthInfo = {
    clientId: "client-1",
    permissions: ["screen:read", "admin:manage"],
  };

  const userAuth: AuthInfo = {
    clientId: "client-2",
    permissions: ["screen:read"],
  };

  it("allows when permission is present", () => {
    expect(() => requirePermission(adminAuth, "admin:manage")).not.toThrow();
  });

  it("allows user with screen:read", () => {
    expect(() => requirePermission(userAuth, "screen:read")).not.toThrow();
  });

  it("throws McpError when permission is missing", () => {
    expect(() => requirePermission(userAuth, "admin:manage")).toThrow(
      "Forbidden"
    );
  });

  it("throws McpError when permissions array is empty", () => {
    const noPerms: AuthInfo = { clientId: "c", permissions: [] };
    expect(() => requirePermission(noPerms, "screen:read")).toThrow(
      "Forbidden"
    );
  });
});
