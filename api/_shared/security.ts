type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_STATE = new Map<string, RateLimitBucket>();
const MAX_RATE_LIMIT_BUCKETS = 10_000;

function getExpectedOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function isAllowedBrowserRequest(request: Request): boolean {
  // Exact Origin matching blocks cross-site browser submissions before they reach paid providers.
  const origin = request.headers.get("origin");
  return origin !== null && origin === getExpectedOrigin(request);
}

export function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function getClientIp(request: Request): string {
  // Prefer Vercel's protected client-IP header, then retain standard proxy headers for local tests and development.
  const forwardedFor = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function makeRoomForBucket(now: number): void {
  if (RATE_LIMIT_STATE.size < MAX_RATE_LIMIT_BUCKETS) return;

  // Expired entries are removed first; the oldest remaining entry is evicted only under sustained churn.
  for (const [key, bucket] of RATE_LIMIT_STATE) {
    if (bucket.resetAt <= now) RATE_LIMIT_STATE.delete(key);
  }
  if (RATE_LIMIT_STATE.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldestKey = RATE_LIMIT_STATE.keys().next().value as string | undefined;
    if (oldestKey) RATE_LIMIT_STATE.delete(oldestKey);
  }
}

export function enforceRateLimit(request: Request, key: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(request)}`;
  const current = RATE_LIMIT_STATE.get(bucketKey);

  if (!current || current.resetAt <= now) {
    makeRoomForBucket(now);
    RATE_LIMIT_STATE.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
    return jsonResponse(
      { error: "Too many requests. Please try again shortly." },
      429,
      {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(current.resetAt / 1_000)),
      },
    );
  }

  current.count += 1;
  RATE_LIMIT_STATE.set(bucketKey, current);
  return null;
}

export function resetRateLimitState(): void {
  // Tests reset module-level state so one endpoint scenario cannot affect another.
  RATE_LIMIT_STATE.clear();
}
