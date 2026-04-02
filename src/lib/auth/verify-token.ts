import * as jose from "jose";
import type { AuthInfo } from "./permissions.js";
import { logger } from "../logger.js";

let _jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!_jwks) {
    const issuer = process.env.AUTH0_ISSUER_BASE_URL;
    if (!issuer) {
      throw new Error("AUTH0_ISSUER_BASE_URL is not set");
    }
    _jwks = jose.createRemoteJWKSet(
      new URL(`${issuer}/.well-known/jwks.json`)
    );
  }
  return _jwks;
}

export async function verifyToken(
  bearerToken: string | undefined
): Promise<AuthInfo | null> {
  if (!bearerToken) return null;

  const issuer = process.env.AUTH0_ISSUER_BASE_URL;
  const audience = process.env.AUTH0_AUDIENCE;

  if (!issuer) {
    logger.error("AUTH0_ISSUER_BASE_URL is not set");
    return null;
  }

  try {
    const { payload } = await jose.jwtVerify(bearerToken, getJwks(), {
      issuer: issuer.endsWith("/") ? issuer : `${issuer}/`,
      audience,
    });

    const clientId =
      (payload.azp as string) || (payload.sub as string) || "unknown";
    const permissions = (payload.permissions as string[]) || [];

    return { clientId, permissions };
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      logger.warn("JWT expired");
    } else if (err instanceof jose.errors.JWSSignatureVerificationFailed) {
      logger.warn("JWT signature verification failed");
    } else {
      logger.error("Token verification error", err);
    }
    return null;
  }
}
