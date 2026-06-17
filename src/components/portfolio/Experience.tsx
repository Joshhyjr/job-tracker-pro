import { Briefcase } from "lucide-react";
import { SectionReveal } from "./SectionReveal";

// Resume-backed experience snapshot; keep entries aligned with the redacted public resume.
const items = [
  {
    role: "Data Analyst",
    organization: "IBM OPOR Project (via Experis)",
    date: "March 2026 - May 2026",
    summary:
      "Supported IBM's One Person One Record healthcare initiative through data entry, validation, cleaning, reconciliation, and legacy data migration across multiple systems.",
  },
  {
    role: "Data Content Intern",
    organization: "Food and Agriculture Organization (FAO, UN)",
    date: "Sept 2025 - Dec 2025",
    summary:
      "Maintained geospatial datasets, applied ISO 19115 and DCAT metadata standards, contributed to Hand-in-Hand Platform frontend fixes, and standardized map styling.",
  },
  {
    role: "End User Support Technician",
    organization: "Saint Mary's University",
    date: "Nov 2022 - Dec 2024",
    summary:
      "Analyzed service and incident data, supported Active Directory and Microsoft Azure access management, and explained technical issues clearly to non-technical users.",
  },
];

export default function Experience() {
  return (
    <section id="experience" className="container py-20">
      <SectionReveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Experience Snapshot</h2>
          <p className="mt-3 text-muted-foreground">
            Data operations, geospatial content, frontend support, and end-user technical support.
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
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary/80">
                    {item.organization} | {item.date}
                  </p>
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
