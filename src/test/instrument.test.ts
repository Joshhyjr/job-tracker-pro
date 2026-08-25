import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  reactRouterBrowserTracingIntegration: vi.fn(() => ({ name: "react-router-tracing" })),
  wrapReactRouterRouting: vi.fn((component) => component),
}));

vi.mock("@sentry/react", () => sentryMocks);

describe("Sentry instrumentation", () => {
  beforeEach(() => {
    // Reload the side-effect module so each test evaluates a fresh environment configuration.
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    // Isolate tests from a developer's ignored .env.local Sentry configuration.
    vi.stubEnv("VITE_SENTRY_DSN", "");
    vi.stubEnv("VITE_SENTRY_RELEASE", "");
    vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "");
    vi.stubEnv("VITE_VERCEL_GIT_COMMIT_SHA", "");
  });

  it("initializes privacy-conscious error monitoring and tracing when a DSN is configured", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    vi.stubEnv("VITE_SENTRY_RELEASE", "job-tracker@abc123");
    vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "test");

    await import("@/instrument");

    expect(sentryMocks.reactRouterBrowserTracingIntegration).toHaveBeenCalledOnce();
    expect(sentryMocks.init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "test",
      release: "job-tracker@abc123",
      tracesSampleRate: 1,
      enableLogs: true,
      dataCollection: expect.objectContaining({
        userInfo: false,
        cookies: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
      }),
    }));
    expect(sentryMocks.wrapReactRouterRouting).toHaveBeenCalledOnce();
  });

  it("leaves Sentry disabled when no DSN is configured", async () => {
    await import("@/instrument");

    // A missing local DSN should never produce malformed monitoring requests.
    expect(sentryMocks.init).not.toHaveBeenCalled();
    expect(sentryMocks.wrapReactRouterRouting).not.toHaveBeenCalled();
  });

  it("tags Vercel events with the immutable deployment commit", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    vi.stubEnv("VITE_VERCEL_GIT_COMMIT_SHA", "def456");

    await import("@/instrument");

    // A deploy-specific release makes regressions traceable without maintaining another production variable.
    expect(sentryMocks.init).toHaveBeenCalledWith(expect.objectContaining({
      release: "job-tracker@def456",
    }));
  });
});
