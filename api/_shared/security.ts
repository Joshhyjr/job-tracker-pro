const RATE_LIMIT_STATE = new Map<string, { count: number; resetAt: number }>();

function getExpectedOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function isAllowedBrowserRequest(request: Request): boolean {
  // Browser-only Origin checks prevent cross-site forms and simple scripts from spending provider quotas.
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
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return request.headers.get("x-real-ip") || "unknown";
}

export function enforceRateLimit(request: Request, key: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(request)}`;
  const current = RATE_LIMIT_STATE.get(bucketKey);

  if (!current || current.resetAt <= now) {
    RATE_LIMIT_STATE.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return jsonResponse(
      { error: "Too many requests. Please try again shortly." },
      429,
      { "Retry-After": String(retryAfterSeconds) },
    );
  }

  current.count += 1;
  RATE_LIMIT_STATE.set(bucketKey, current);
  return null;
}

export function resetRateLimitState(): void {
  RATE_LIMIT_STATE.clear();
}
