import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";

// Career timeline — one chronological list, mono date readouts, dot per entry.
const entries = [
  {
    role: "Data Analyst",
    org: "IBM OPOR Project (via Experis)",
    date: "MAR 2026 — MAY 2026",
    points: [
      "Validated, cleaned, and reconciled records across legacy healthcare systems.",
      "Supported the One Person One Record migration with structured data entry.",
    ],
    milestone: "Current",
  },
  {
    role: "Data Content Intern",
    org: "Food & Agriculture Organization (FAO, UN)",
    date: "SEP 2025 — DEC 2025",
    points: [
      "Applied ISO 19115 and DCAT metadata standards to geospatial datasets.",
      "Contributed frontend bug fixes to the Hand-in-Hand Platform.",
      "Standardized map styling and dataset documentation.",
    ],
  },
  {
    role: "End User Support Technician",
    org: "Saint Mary's University",
    date: "NOV 2022 — DEC 2024",
    points: [
      "Resolved Active Directory and Microsoft Azure access requests.",
      "Analyzed incident data to find recurring root causes.",
      "Translated technical issues into clear guidance for non-technical users.",
    ],
  },
];

export default function JourneyLog() {
  return (
    <SectionPanel
      id="journey"
      eyebrow="04 · Journey Log"
      title="The road so far"
      description="Roles where I've shipped data, supported users, and learned from real production systems."
    >
      <ol className="relative mx-auto max-w-3xl space-y-8 border-l border-border/60 pl-8">
        {entries.map((e, idx) => (
          <SectionReveal key={e.role} delay={idx * 90}>
            <li className="relative">
              {/* Timeline dot */}
              <span
                className="absolute -left-[37px] top-2 inline-block h-2.5 w-2.5 rounded-full ring-4 ring-background"
                style={{
                  background:
                    e.milestone === "Current"
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted-foreground))",
                }}
                aria-hidden="true"
              />
              <div className="glass-subtle rounded-xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">{e.role}</h3>
                  {e.milestone ? (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-primary">
                      {e.milestone}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="text-sm text-foreground/85">{e.org}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {e.date}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  {e.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          </SectionReveal>
        ))}
      </ol>
    </SectionPanel>
  );
}
