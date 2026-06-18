// Minimal footer — single status line + brand mark.
export default function CockpitFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60">
      <div className="container flex flex-col items-center justify-between gap-3 py-8 text-center md:flex-row md:text-left">
        <div className="flex items-center gap-2.5">
          <img src="/brand-mark.svg" alt="" aria-hidden="true" className="h-5 w-5 brightness-0 invert" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Joshua Kivaria · Halifax, NS · {year}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Driven by data · Tuned for support · Built to ship
        </span>
      </div>
    </footer>
  );
}
