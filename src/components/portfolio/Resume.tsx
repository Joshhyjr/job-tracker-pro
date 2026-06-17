import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionReveal } from "./SectionReveal";

// Resume download area served from the redacted public PDF in /public.
export default function Resume() {
  return (
    <section id="resume" className="container py-20">
      <SectionReveal>
        <div className="mx-auto max-w-3xl glass rounded-3xl p-8 text-center sm:p-12">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">My Resume</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            A redacted public copy of my experience, skills, and projects for recruiters and hiring managers.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              {/* Downloads a resume PDF with direct contact PII removed. */}
              <a href="/resume.pdf" download>
                <Download /> Download My Resume
              </a>
            </Button>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
