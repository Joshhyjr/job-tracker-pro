import { Button } from "@/components/ui/button";
import { triggerSentryTestError } from "@/lib/sentryDiagnostics";

export function SentryErrorButton() {
  // Keep the destructive test action visually distinct from ordinary settings controls.
  return (
    <Button onClick={triggerSentryTestError} type="button" variant="destructive">
      Break the world
    </Button>
  );
}
