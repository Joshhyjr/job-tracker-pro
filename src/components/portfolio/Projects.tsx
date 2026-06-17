import { ArrowUpRight, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SectionReveal } from "./SectionReveal";

// Featured projects. Replace the `#` GitHub placeholders with real repo URLs.
type Project = {
  title: string;
  description: string;
  tech: string[];
  view: { href: string; label?: string; internal?: boolean };
  github: string;
};

const projects: Project[] = [
  {
    title: "Job Tracker Pro",
    description:
      "A web app for tracking job applications — statuses, follow-ups, dashboards, and AI-powered insights to spot trends in your search.",
    tech: ["React", "Vite", "TypeScript", "Recharts", "AI"],
    view: { href: "/app", label: "Open Live App", internal: true },
    github: "#", // TODO: add Job Tracker Pro repo URL
  },
  {
    title: "Grocery Deals Finder",
    description:
      "A React + Vite app to search grocery deals, filter by store, manage a basket, and export results — built for everyday saving.",
    tech: ["React", "Vite", "JavaScript"],
    view: { href: "#" }, // TODO: live demo URL
    github: "#", // TODO: repo URL
  },
  {
    title: "Spam Detection Model",
    description:
      "A Python machine learning project using NLP, TF-IDF features, and scikit-learn to classify messages as spam or not spam.",
    tech: ["Python", "scikit-learn", "NLP", "TF-IDF"],
    view: { href: "#" },
    github: "#",
  },
  {
    title: "Inventory & Budget Web App",
    description:
      "A Flask + MySQL application for managing inventory and budget projections — built for small teams that need clarity over spreadsheets.",
    tech: ["Flask", "MySQL", "Python"],
    view: { href: "#" },
    github: "#",
  },
];

export default function Projects() {
  return (
    <section id="projects" className="container py-20">
      <SectionReveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Featured Projects</h2>
          <p className="mt-3 text-muted-foreground">A few things I've built recently.</p>
        </div>
      </SectionReveal>

      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((p, idx) => (
          <SectionReveal key={p.title} delay={idx * 80}>
            <article className="group relative h-full overflow-hidden glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
              {/* Decorative gradient corner */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl transition-opacity duration-300 group-hover:opacity-100 opacity-60" />

              <h3 className="font-display text-xl font-semibold">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {p.tech.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {p.view.internal ? (
                  <Button asChild size="sm">
                    <Link to={p.view.href}>
                      {p.view.label ?? "View Project"} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <a href={p.view.href} target="_blank" rel="noreferrer">
                      {p.view.label ?? "View Project"} <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <a href={p.github} target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" /> GitHub
                  </a>
                </Button>
              </div>
            </article>
          </SectionReveal>
        ))}
      </div>
    </section>
  );
}
