import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export interface AuthInfo {
  clientId: string;
  permissions: string[];
}

export function requirePermission(auth: AuthInfo, permission: string): void {
  if (!auth.permissions.includes(permission)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Forbidden: missing required permission '${permission}'`
    );
  }
}
