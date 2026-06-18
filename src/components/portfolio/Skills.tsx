import { BarChart3, Wrench, Code2, Sparkles } from "lucide-react";
import { SectionReveal } from "./SectionReveal";

// Grouped skill cards using lucide icons. Add/remove items as your stack grows.
const groups = [
  {
    icon: BarChart3,
    title: "Data Analysis",
    // Include credential-backed analytics skills without duplicating existing entries.
    items: [
      "Excel",
      "SQL",
      "Python",
      "pandas",
      "Data cleaning",
      "Data Refinery",
      "Data Visualization",
      "Tableau",
      "Reporting",
      "Dashboards",
    ],
  },
  {
    icon: Wrench,
    title: "Technical Support",
    items: ["Troubleshooting", "Ticketing", "User support", "Documentation", "Systems support"],
  },
  {
    icon: Code2,
    title: "Development",
    items: ["React", "Vite", "HTML", "CSS", "JavaScript", "Flask", "MySQL"],
  },
  {
    icon: Sparkles,
    title: "Tools & AI",
    // AWS is supported by the listed Digital Nova Scotia certifications.
    items: ["ChatGPT", "Claude", "Codex", "Gemini", "GitHub", "AWS", "Vercel", "Cloudflare"],
  },
];

export default function Skills() {
  return (
    <section id="skills" className="container py-20">
      <SectionReveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Skills</h2>
          <p className="mt-3 text-muted-foreground">
            A snapshot of the tools and disciplines I use day to day.
          </p>
        </div>
      </SectionReveal>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g, idx) => (
          <SectionReveal key={g.title} delay={idx * 80}>
            <div className="group h-full glass rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <g.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{g.title}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-xs text-foreground/80"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </SectionReveal>
        ))}
      </div>
    </section>
  );
}
