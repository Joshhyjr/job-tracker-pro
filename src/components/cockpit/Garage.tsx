import { ArrowUpRight, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";

// Project = "vehicle" — spec sheet card with stack/role/status rows.
type ProjectStatus = "Live" | "In progress" | "Archived";
type Project = {
  model: string;
  tagline: string;
  stack: string;
  role: string;
  status: ProjectStatus;
  open: { href: string; label?: string; internal?: boolean };
  source?: string;
};

const projects: Project[] = [
  {
    model: "FAO Hand-in-Hand Platform",
    tagline:
      "Geospatial decision-making platform — frontend fixes and dataset validation during my FAO internship.",
    stack: "Frontend · Geospatial data · Validation",
    role: "Data Content Intern",
    status: "Live",
    open: { href: "https://data.apps.fao.org/?lang=en", label: "View Platform" },
  },
  {
    model: "Job Tracker",
    tagline:
      "Track applications, follow-ups, locations, and AI-powered insights — featured project, launches in-app.",
    stack: "React · Vite · TypeScript · Recharts",
    role: "Designer & Developer",
    status: "Live",
    open: { href: "/app", label: "Launch", internal: true },
    source: "https://github.com/Joshhyjr/job-tracker-pro",
  },
  {
    model: "Grocery Deals Finder",
    tagline:
      "Search grocery deals, filter by store, manage a basket, and export results — built for everyday saving.",
    stack: "React · Vite · JavaScript",
    role: "Solo build",
    status: "Live",
    open: { href: "https://joshhyjr.github.io/Grocerydealsfinder/" },
    source: "https://github.com/Joshhyjr/Grocerydealsfinder",
  },
  {
    model: "Spam Detection Model",
    tagline:
      "NLP + TF-IDF + scikit-learn classifier that flags spam messages from a labeled dataset.",
    stack: "Python · scikit-learn · NLP",
    role: "Solo build",
    status: "Archived",
    open: { href: "https://github.com/Joshhyjr/SpamFilter", label: "View Repo" },
    source: "https://github.com/Joshhyjr/SpamFilter",
  },
];

// Status dot color follows traffic-light convention.
function statusColor(status: ProjectStatus) {
  if (status === "Live") return "hsl(var(--status-green))";
  if (status === "In progress") return "hsl(var(--status-amber))";
  return "hsl(var(--muted-foreground))";
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border/60 py-2.5 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-foreground/90">{value}</span>
    </div>
  );
}

export default function Garage() {
  return (
    <SectionPanel
      id="garage"
      eyebrow="03 · The Garage"
      title="Selected projects"
      description="Each one is a build, a contribution, or an experiment that I'd happily walk through in an interview."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((p, idx) => (
          <SectionReveal key={p.model} delay={idx * 80}>
            <article className="glass group flex h-full flex-col rounded-xl p-6 transition-colors duration-300 hover:border-primary/40">
              <header className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Model
                  </div>
                  <h3 className="mt-1 font-display text-xl font-semibold">{p.model}</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: statusColor(p.status) }}
                  />
                  {p.status}
                </span>
              </header>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p.tagline}</p>

              <div className="mt-5">
                <SpecRow label="Stack" value={p.stack} />
                <SpecRow label="Role" value={p.role} />
              </div>

              <div className="mt-6 flex flex-wrap gap-2 pt-1">
                {p.open.internal ? (
                  <Button asChild size="sm">
                    <Link to={p.open.href}>
                      {p.open.label ?? "Open"} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <a href={p.open.href} target="_blank" rel="noreferrer">
                      {p.open.label ?? "Open"} <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {p.source ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={p.source} target="_blank" rel="noreferrer">
                      <Github className="h-4 w-4" /> Source
                    </a>
                  </Button>
                ) : null}
              </div>
            </article>
          </SectionReveal>
        ))}
      </div>

      <SectionReveal className="mt-10 text-center">
        <Button asChild size="sm" variant="ghost">
          <a href="https://github.com/Joshhyjr" target="_blank" rel="noreferrer">
            See more on GitHub <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      </SectionReveal>
    </SectionPanel>
  );
}
