import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionReveal } from "./SectionReveal";

// Shared cockpit section wrapper: enforces spacing, eyebrow label, and heading style.
export default function SectionPanel({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("container py-24 md:py-32", className)}>
      <SectionReveal>
        <div className="mb-10 flex flex-col gap-3 md:mb-14">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/80">
            {eyebrow}
          </span>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </SectionReveal>
      {children}
    </section>
  );
}
