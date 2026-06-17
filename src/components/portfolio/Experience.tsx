import { Briefcase } from "lucide-react";
import { SectionReveal } from "./SectionReveal";

// Timeline-style experience snapshot. Edit dates/copy as needed.
const items = [
  {
    role: "Data Analyst",
    summary:
      "Cleaned and validated data, built reports and dashboards, and communicated insights to stakeholders to support better decision-making.",
  },
  {
    role: "Technical Support / IT Support",
    summary:
      "Troubleshot hardware, software, and network issues; documented fixes; supported end users; and improved internal processes to reduce repeat tickets.",
  },
  {
    role: "Administrative & Operations",
    summary:
      "Coordinated documentation, reporting, and stakeholder communication while streamlining day-to-day workflows.",
  },
];

export default function Experience() {
  return (
    <section id="experience" className="container py-20">
      <SectionReveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Experience Snapshot</h2>
          <p className="mt-3 text-muted-foreground">
            Data validation, troubleshooting, documentation, reporting, and improving workflows.
          </p>
        </div>
      </SectionReveal>

      <div className="relative mx-auto max-w-3xl">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent md:left-1/2" />

        <ul className="space-y-8">
          {items.map((item, idx) => (
            <SectionReveal key={item.role} delay={idx * 100}>
              <li className="relative pl-12 md:grid md:grid-cols-2 md:gap-8 md:pl-0">
                {/* Dot */}
                <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 ring-4 ring-background md:left-1/2 md:-translate-x-1/2">
                  <Briefcase className="h-3 w-3 text-primary" />
                </span>

                <div
                  className={`glass rounded-2xl p-5 ${
                    idx % 2 === 0 ? "md:col-start-1 md:text-right md:pr-10" : "md:col-start-2 md:pl-10"
                  }`}
                >
                  <h3 className="font-display text-lg font-semibold">{item.role}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                </div>
              </li>
            </SectionReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
