import * as Sentry from "@sentry/react";

export function triggerSentryTestError(): never {
  // Emit identifiable diagnostics before the deliberate error reaches Sentry's global handler.
  Sentry.logger.info("User triggered test error", {
    action: "test_error_button_click",
  });
  Sentry.metrics.count("test_counter", 1);

  throw new Error("This is your first error!");
}
