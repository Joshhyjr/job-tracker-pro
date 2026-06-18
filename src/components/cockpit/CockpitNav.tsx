import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBar from "./StatusBar";

// Sections with both a plain label and a cockpit subtitle (recruiter-friendly).
const sections = [
  { id: "driver", label: "About", sub: "Driver" },
  { id: "performance", label: "Skills", sub: "Performance" },
  { id: "garage", label: "Projects", sub: "Garage" },
  { id: "journey", label: "Experience", sub: "Journey" },
  { id: "licenses", label: "Certs", sub: "Licenses" },
  { id: "spec-sheet", label: "Resume", sub: "Spec Sheet" },
  { id: "ignition", label: "Contact", sub: "Ignition" },
];

export default function CockpitNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md transition-colors ${
        scrolled ? "bg-background/95" : ""
      }`}
      aria-label="Primary"
    >
      <div className="container flex h-14 items-center justify-between gap-6">
        {/* Brand mark — reuses the shared monogram with a quiet wordmark. */}
        <a
          href="#cockpit"
          className="inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Joshua Kivaria — Cockpit home"
        >
          <img
            src="/brand-mark.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 brightness-0 invert"
          />
          <span className="font-display text-sm font-semibold tracking-tight">
            Joshua Kivaria
          </span>
        </a>

        {/* Desktop section links — single line, plain labels. */}
        <div className="hidden items-center gap-1 lg:flex">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              {s.label}
              <span className="ml-1 hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 xl:inline">
                · {s.sub}
              </span>
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <StatusBar />
          <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
            <Link to="/app">Launch Job Tracker</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 p-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <span>{s.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  {s.sub}
                </span>
              </a>
            ))}
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/app" onClick={() => setOpen(false)}>
                Launch Job Tracker
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
