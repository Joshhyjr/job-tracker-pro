import { useEffect, useRef, useState } from "react";
import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";

// Performance bar — labeled, thin, fills on scroll-into-view.
function PerformanceBar({ name, level }: { name: string; level: "Advanced" | "Proficient" | "Working" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Map qualitative level to a visual width (no numeric percent shown).
  const width = level === "Advanced" ? "92%" : level === "Proficient" ? "72%" : "52%";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {level}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full origin-left rounded-full bg-primary/90 transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{
            width,
            transform: visible ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </div>
    </div>
  );
}

// Three grouped panels. Skill set sourced from existing portfolio data.
const panels: { title: string; eyebrow: string; skills: { name: string; level: "Advanced" | "Proficient" | "Working" }[] }[] = [
  {
    title: "Data",
    eyebrow: "Module A",
    skills: [
      { name: "Excel", level: "Advanced" },
      { name: "SQL", level: "Proficient" },
      { name: "Python · pandas", level: "Proficient" },
      { name: "Tableau", level: "Proficient" },
      { name: "Data cleaning", level: "Advanced" },
      { name: "Dashboards & reporting", level: "Proficient" },
    ],
  },
  {
    title: "Support & Systems",
    eyebrow: "Module B",
    skills: [
      { name: "Troubleshooting", level: "Advanced" },
      { name: "Ticketing & documentation", level: "Advanced" },
      { name: "Active Directory · Azure", level: "Proficient" },
      { name: "End-user communication", level: "Advanced" },
      { name: "Systems support", level: "Proficient" },
    ],
  },
  {
    title: "Development",
    eyebrow: "Module C",
    skills: [
      { name: "React · Vite · TypeScript", level: "Proficient" },
      { name: "HTML · CSS · JavaScript", level: "Advanced" },
      { name: "Flask · MySQL", level: "Working" },
      { name: "Git · GitHub", level: "Proficient" },
      { name: "AI tooling (Claude, GPT, Codex)", level: "Advanced" },
    ],
  },
];

export default function PerformanceSpecs() {
  return (
    <SectionPanel
      id="performance"
      eyebrow="02 · Performance Specs"
      title="What I'm tuned for"
      description="Capabilities grouped by module — qualitative levels instead of arbitrary percentages."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {panels.map((panel, idx) => (
          <SectionReveal key={panel.title} delay={idx * 90}>
            <div className="glass h-full rounded-xl p-6">
              <div className="mb-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
                  {panel.eyebrow}
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">{panel.title}</h3>
              </div>
              <div className="space-y-4">
                {panel.skills.map((s) => (
                  <PerformanceBar key={s.name} name={s.name} level={s.level} />
                ))}
              </div>
            </div>
          </SectionReveal>
        ))}
      </div>
    </SectionPanel>
  );
}
