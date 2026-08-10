import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import aiInsightsHandler from "../../api/ai-insights";
import contactHandler from "../../api/contact";
import { RequestPayloadTooLargeError, toBoundedWebRequest } from "../../api/_shared/security";

function incomingRequest(body: Buffer, headers: Record<string, string> = {}): IncomingMessage {
  const stream = new PassThrough();
  // A PassThrough supplies the Node stream contract while these fields mirror Vercel's IncomingMessage metadata.
  Object.assign(stream, {
    method: "POST",
    url: "/api/test",
    headers: { host: "portfolio.example", ...headers },
  });
  stream.end(body);
  return stream as unknown as IncomingMessage;
}

function mockNodeResponse(): {
  response: ServerResponse;
  headers: Map<string, string>;
  getBody: () => string;
} {
  const headers = new Map<string, string>();
  let body = "";
  const response = {
    statusCode: 200,
    setHeader(name: string, value: number | string | readonly string[]) {
      headers.set(name.toLowerCase(), String(value));
      return this;
    },
    end(chunk?: string | Buffer) {
      body = chunk === undefined ? "" : String(chunk);
      return this;
    },
  } as unknown as ServerResponse;

  return { response, headers, getBody: () => body };
}

describe("bounded Vercel request adapter", () => {
  it("rejects an oversized declared content length with a typed error", async () => {
    const request = incomingRequest(Buffer.from("oversized"), { "content-length": "9" });

    await expect(toBoundedWebRequest(request, 8)).rejects.toEqual(expect.objectContaining({
      name: "RequestPayloadTooLargeError",
      maxBytes: 8,
    } satisfies Partial<RequestPayloadTooLargeError>));
  });

  it("rejects an oversized streamed body when content length is absent", async () => {
    const stream = new PassThrough();
    Object.assign(stream, {
      method: "POST",
      url: "/api/test",
      headers: { host: "portfolio.example" },
    });
    const request = stream as unknown as IncomingMessage;
    const boundedRequest = toBoundedWebRequest(request, 8);
    stream.write(Buffer.alloc(9));

    await expect(boundedRequest).rejects.toBeInstanceOf(RequestPayloadTooLargeError);
    // The overflow path must keep an error listener while the remaining request stream drains.
    expect(stream.listenerCount("error")).toBeGreaterThan(0);
    expect(() => stream.emit("error", new Error("late stream failure"))).not.toThrow();
    stream.end();
  });

  it("preserves an in-limit body when constructing the Web Request", async () => {
    const request = incomingRequest(Buffer.from("{}"), {
      "content-length": "2",
      "content-type": "application/json; charset=utf-8",
    });

    const webRequest = await toBoundedWebRequest(request, 8);
    expect(webRequest.method).toBe("POST");
    await expect(webRequest.text()).resolves.toBe("{}");
  });

  it("maps early size failures to 413 responses in both endpoint handlers", async () => {
    const contactResponse = mockNodeResponse();
    await contactHandler(
      incomingRequest(Buffer.alloc(8_193), { "content-length": "8193" }),
      contactResponse.response,
    );

    const aiResponse = mockNodeResponse();
    // Omitting Content-Length exercises the streamed-byte cap in the AI handler path.
    await aiInsightsHandler(incomingRequest(Buffer.alloc(16_385)), aiResponse.response);

    expect(contactResponse.response.statusCode).toBe(413);
    expect(contactResponse.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(contactResponse.getBody())).toEqual({ error: "Message is too large." });
    expect(aiResponse.response.statusCode).toBe(413);
    expect(aiResponse.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(aiResponse.getBody())).toEqual({ error: "Request payload is too large." });
  });
});
