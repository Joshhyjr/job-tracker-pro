import { ArrowRight, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Speedometer from "./Speedometer";

// Cockpit hero — name, role line, tagline, single gauge, three CTAs.
export default function Hero() {
  return (
    <section id="cockpit" className="relative overflow-hidden">
      <div className="container grid items-center gap-12 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span
              className="status-dot-pulse inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--status-green))" }}
            />
            Driver online · Halifax, NS
          </div>

          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Joshua Kivaria
          </h1>

          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Data Analyst by title. Problem-solver by nature. Builder by habit.
          </p>

          <p className="max-w-xl text-lg leading-relaxed text-foreground/85">
            <span className="text-foreground">Driven by data.</span>{" "}
            <span className="text-foreground">Tuned for support.</span>{" "}
            <span className="text-foreground">Built to ship.</span>
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg" className="group">
              <a href="#garage">
                View The Garage
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/resume.pdf" download>
                <Download /> Download Spec Sheet
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#ignition">
                <Mail /> Start the Engine
              </a>
            </Button>
          </div>
        </div>

        <div className="relative">
          <Speedometer value={85} label="Availability" caption="Open to work" />
        </div>
      </div>

      <div className="container">
        <div className="cockpit-divider" />
      </div>
    </section>
  );
}
