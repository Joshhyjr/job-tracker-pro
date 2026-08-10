import type { IncomingMessage } from "node:http";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_STATE = new Map<string, RateLimitBucket>();
const MAX_RATE_LIMIT_BUCKETS = 10_000;
const PROVIDER_REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id", "x-goog-request-id", "x-guploader-uploadid"] as const;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:/=+-]{1,160}$/;

export class RequestPayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request payload exceeds the ${maxBytes}-byte limit.`);
    this.name = "RequestPayloadTooLargeError";
  }
}

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

export function isJsonRequest(request: Request): boolean {
  // Compare the parsed media type exactly so lookalikes such as application/jsonx are rejected.
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

export function getProviderRequestId(response: Response): string | null {
  // Only short, identifier-shaped correlation headers are safe to copy into retained server logs.
  for (const header of PROVIDER_REQUEST_ID_HEADERS) {
    const value = response.headers.get(header)?.trim();
    if (value && SAFE_REQUEST_ID.test(value)) return value;
  }
  return null;
}

export async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body || response.bodyUsed) return;
  try {
    // Release provider connections without decoding or retaining response content that may echo private input.
    await response.body.cancel();
  } catch {
    // Cancellation is best-effort and must not replace the endpoint's sanitized provider error contract.
  }
}

function getDeclaredContentLength(request: IncomingMessage): number | null {
  const header = request.headers["content-length"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;

  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
}

function readBoundedRequestBody(request: IncomingMessage, maxBytes: number): Promise<Buffer | undefined> {
  const method = request.method || "GET";
  if (method === "GET" || method === "HEAD") return Promise.resolve(undefined);

  const declaredLength = getDeclaredContentLength(request);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    let draining = false;

    function cleanup() {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
      request.off("close", onClose);
    }
    function rejectTooLarge() {
      if (settled) return;
      settled = true;
      draining = true;
      chunks.length = 0;
      request.off("data", onData);
      // Keep terminal listeners attached while resume() safely drains and discards the remaining bytes.
      request.resume();
      reject(new RequestPayloadTooLargeError(maxBytes));
    }
    function onData(chunk: Buffer | string) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) {
        rejectTooLarge();
        return;
      }
      chunks.push(buffer);
    }
    function onEnd() {
      cleanup();
      if (settled) return;
      settled = true;
      resolve(chunks.length ? Buffer.concat(chunks, totalBytes) : undefined);
    }
    function onError(error: Error) {
      cleanup();
      if (settled) return;
      settled = true;
      reject(error);
    }
    function onAborted() {
      if (settled) return;
      settled = true;
      draining = true;
      chunks.length = 0;
      // Node may emit an error after aborted, so retain terminal listeners until error or close.
      reject(new Error("Request body was aborted."));
    }
    function onClose() {
      cleanup();
      if (settled || draining) return;
      settled = true;
      reject(new Error("Request body closed before completion."));
    }

    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
    request.once("close", onClose);
    if (declaredLength !== null && declaredLength > maxBytes) {
      rejectTooLarge();
      return;
    }
    // Attach data last so terminal/error listeners are ready before the stream enters flowing mode.
    request.on("data", onData);
  });
}

export async function toBoundedWebRequest(request: IncomingMessage, maxBytes: number): Promise<Request> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError("maxBytes must be a non-negative safe integer.");

  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  });

  const protocolHeader = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader || "https";
  const host = request.headers.host || "localhost";
  const method = request.method || "GET";
  // Bound both declared and chunked bodies before constructing the in-memory Web Request used by route logic.
  const body = await readBoundedRequestBody(request, maxBytes);

  return new Request(`${protocol}://${host}${request.url || "/"}`, {
    method,
    headers,
    // These endpoints accept JSON text only; decoding after the byte cap keeps the Web Request body type portable.
    body: body?.toString("utf8"),
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
