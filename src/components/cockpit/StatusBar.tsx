import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

// Compact cockpit status readout: live Halifax clock + location + systems-nominal dot.
export default function StatusBar() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Update once per minute — second-by-second flicker would be visually noisy.
    const tick = () => {
      const now = new Date().toLocaleTimeString("en-CA", {
        timeZone: "America/Halifax",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setTime(now);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hidden items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:flex">
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="h-3 w-3" aria-hidden="true" />
        Halifax · NS
      </span>
      <span aria-hidden="true" className="h-3 w-px bg-border/60" />
      <span aria-label="Local time">{time} AST</span>
      <span aria-hidden="true" className="h-3 w-px bg-border/60" />
      <span className="inline-flex items-center gap-1.5">
        <span
          className="status-dot-pulse inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "hsl(var(--status-green))" }}
        />
        Systems nominal
      </span>
    </div>
  );
}
