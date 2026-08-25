import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  metricsCount: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  logger: { info: sentryMocks.loggerInfo },
  metrics: { count: sentryMocks.metricsCount },
}));

import { triggerSentryTestError } from "@/lib/sentryDiagnostics";

describe("SentryErrorButton", () => {
  beforeEach(() => {
    // Keep each deliberate trigger assertion isolated from previous diagnostics.
    vi.clearAllMocks();
  });

  it("emits a log and metric before throwing the identifiable test error", () => {
    expect(() => triggerSentryTestError()).toThrow("This is your first error!");

    expect(sentryMocks.loggerInfo).toHaveBeenCalledWith("User triggered test error", {
      action: "test_error_button_click",
    });
    expect(sentryMocks.metricsCount).toHaveBeenCalledWith("test_counter", 1);
    expect(sentryMocks.loggerInfo.mock.invocationCallOrder[0]).toBeLessThan(
      sentryMocks.metricsCount.mock.invocationCallOrder[0],
    );
  });
});
