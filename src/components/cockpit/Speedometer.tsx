import { useEffect, useState } from "react";

// Single restrained SVG gauge. Animates the needle once from 0 to `value` on mount.
// Respects prefers-reduced-motion (snaps straight to value).
export default function Speedometer({
  value,
  label = "Availability",
  caption = "Open to work",
  max = 100,
}: {
  value: number;
  label?: string;
  caption?: string;
  max?: number;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCurrent(value);
      return;
    }
    // Trigger transition on the next frame so the CSS transition picks up the change.
    const raf = window.requestAnimationFrame(() => setCurrent(value));
    return () => window.cancelAnimationFrame(raf);
  }, [value]);

  // Sweep angle: -120° (left) to +120° (right) — a 240° arc.
  const ratio = Math.max(0, Math.min(1, current / max));
  const angle = -120 + ratio * 240;

  // Arc path from start (-120°) to end (+120°) on a 120-radius circle centered at (160, 160).
  const polar = (deg: number, r = 120) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return [160 + r * Math.cos(rad), 160 + r * Math.sin(rad)] as const;
  };
  const [sx, sy] = polar(-120);
  const [ex, ey] = polar(120);
  const arc = `M ${sx} ${sy} A 120 120 0 1 1 ${ex} ${ey}`;

  // Tick marks every 24° (10 ticks across the arc).
  const ticks = Array.from({ length: 11 }, (_, i) => -120 + (i * 240) / 10);

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <svg
        viewBox="0 0 320 260"
        className="block h-auto w-full"
        role="img"
        aria-label={`${label}: ${value} out of ${max}`}
      >
        {/* Outer dial ring — subtle inner shadow effect via stroke layering. */}
        <circle cx="160" cy="160" r="138" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />

        {/* Background arc track. */}
        <path d={arc} fill="none" stroke="hsl(var(--border))" strokeWidth="10" strokeLinecap="round" />

        {/* Active progress arc — drawn via stroke-dasharray to match needle position. */}
        <path
          d={arc}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - ratio}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)" }}
        />

        {/* Tick marks. */}
        {ticks.map((deg, i) => {
          const [x1, y1] = polar(deg, 108);
          const [x2, y2] = polar(deg, i % 5 === 0 ? 92 : 100);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--muted-foreground) / 0.5)"
              strokeWidth={i % 5 === 0 ? 1.5 : 1}
            />
          );
        })}

        {/* Needle — rotated about the center, transitions smoothly. */}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: "160px 160px",
            transition: "transform 1.4s cubic-bezier(.22,.61,.36,1)",
          }}
        >
          <line x1="160" y1="160" x2="160" y2="60" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="160" cy="60" r="3.5" fill="hsl(var(--primary))" />
        </g>

        {/* Hub. */}
        <circle cx="160" cy="160" r="10" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
        <circle cx="160" cy="160" r="3" fill="hsl(var(--primary))" />
      </svg>

      {/* Readout block — sits inside the dial visually. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {label}
        </div>
        <div className="font-display text-4xl font-semibold tabular-nums">
          {Math.round(current)}
          <span className="ml-0.5 text-lg text-muted-foreground">/{max}</span>
        </div>
        <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span
            className="status-dot-pulse inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "hsl(var(--status-green))" }}
          />
          {caption}
        </div>
      </div>
    </div>
  );
}
