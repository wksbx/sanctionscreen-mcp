// src/lib/crawlers/safe-fetch.ts
// Size-limited and timeout-aware fetch wrapper for crawlers.

/** Default max response size: 100 MB */
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

/** Default fetch timeout: 60 seconds */
const DEFAULT_TIMEOUT_MS = 60_000;

export class FetchSizeLimitError extends Error {
  constructor(url: string, maxBytes: number) {
    super(`Response from ${url} exceeds size limit of ${maxBytes} bytes`);
    this.name = 'FetchSizeLimitError';
  }
}

export interface SafeFetchOptions {
  /** Max response body size in bytes (default 100 MB). */
  maxBytes?: number;
  /** Request timeout in milliseconds (default 60s). */
  timeoutMs?: number;
}

/**
 * Fetches a URL with size and timeout limits.
 * Returns the Response object (caller reads the body as needed).
 *
 * Throws on HTTP errors, timeout, or Content-Length exceeding the limit.
 * For responses without Content-Length, the body is consumed and checked
 * incrementally via `readSizedText`.
 */
export async function safeFetch(
  url: string,
  options?: SafeFetchOptions,
): Promise<Response> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Fetch failed: HTTP ${response.status}`);
    }

    // Reject early if Content-Length header exceeds limit
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw new FetchSizeLimitError(url, maxBytes);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the full response body as text, enforcing a byte-size limit.
 * Use this instead of `response.text()` when size limits matter.
 */
export async function readSizedText(
  response: Response,
  url: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      reader.cancel();
      throw new FetchSizeLimitError(url, maxBytes);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());

  return chunks.join('');
}
