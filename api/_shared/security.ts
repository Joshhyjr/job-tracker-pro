type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const RATE_LIMIT_STORE_KEY = "__jobTrackerRateLimitStore";

function getRateLimitStore(): Map<string, RateLimitEntry> {
  const globalState = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitEntry>;
  };

  if (!globalState[RATE_LIMIT_STORE_KEY]) {
    // Keep the limiter process-local so individual serverless instances can cheaply reject bursts.
    globalState[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitEntry>();
  }

  return globalState[RATE_LIMIT_STORE_KEY];
}

export function resetRateLimitStore(): void {
  getRateLimitStore().clear();
}

export function jsonResponse(body: unknown, status: number, extraHeaders: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function getExpectedOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function isSameOrigin(request: Request): boolean {
  // Require browser-originated requests so cross-site forms and scripts cannot spend server-side quota.
  const origin = request.headers.get("origin");
  return origin !== null && origin === getExpectedOrigin(request);
}

function getClientAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

export function enforceRateLimit(request: Request, bucket: string, options: RateLimitOptions): Response | null {
  const now = Date.now();
  const store = getRateLimitStore();
  const key = `${bucket}:${getClientAddress(request)}`;
  const current = store.get(key);

  if (!current || current.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
    return jsonResponse(
      { error: "Too many requests. Please wait and try again." },
      429,
      { "Retry-After": String(retryAfterSeconds) },
    );
  }

  current.count += 1;
  store.set(key, current);
  return null;
}
