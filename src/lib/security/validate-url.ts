// src/lib/security/validate-url.ts
// SSRF protection: blocks requests to private networks, localhost, and cloud metadata endpoints.

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.google',
]);

const BLOCKED_METADATA_PATHS = [
  '/latest/meta-data',       // AWS
  '/metadata/v1',            // DigitalOcean
  '/computeMetadata/v1',     // GCP
  '/metadata/instance',      // Azure
];

/** Returns true if the IP string falls in a private/reserved range. */
function isPrivateIp(hostname: string): boolean {
  // IPv4 private ranges
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  // Link-local
  if (/^169\.254\./.test(hostname)) return true;
  // Loopback
  if (/^127\./.test(hostname)) return true;
  // IPv6 private
  if (hostname.startsWith('[fc') || hostname.startsWith('[fd')) return true;
  if (hostname === '[::1]') return true;
  return false;
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

/**
 * Validates a URL is safe to fetch (not pointing at internal resources).
 * Throws SsrfError if the URL is blocked.
 */
export function validateExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`);
  }

  // Only allow http(s)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError(`Blocked protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SsrfError(`Blocked hostname: ${hostname}`);
  }

  if (isPrivateIp(hostname)) {
    throw new SsrfError(`Blocked private IP: ${hostname}`);
  }

  // Block cloud metadata endpoints (e.g. http://169.254.169.254/latest/meta-data)
  const normalizedPath = url.pathname.replace(/\/+$/, '');
  for (const metaPath of BLOCKED_METADATA_PATHS) {
    if (normalizedPath.startsWith(metaPath)) {
      throw new SsrfError(`Blocked metadata endpoint: ${url.href}`);
    }
  }

  return url;
}
