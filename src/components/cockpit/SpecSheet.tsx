import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";

// Resume download panel. Single CTA — keep it calm.
export default function SpecSheet() {
  return (
    <SectionPanel id="spec-sheet" eyebrow="06 · Spec Sheet" title="The full resume">
      <SectionReveal>
        <div className="glass mx-auto flex max-w-3xl flex-col items-start gap-6 rounded-xl p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/40 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Joshua Kivaria — Spec Sheet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                PDF copy of my experience, skills, and projects. Direct contact details redacted.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <a href="/resume.pdf" download>
              <Download /> Download PDF
            </a>
          </Button>
        </div>
      </SectionReveal>
    </SectionPanel>
  );
}
