import { Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoCarousel } from "./AutoCarousel";
import { SectionReveal } from "./SectionReveal";

// Public credentials shown newest first, with direct verification links for recruiters.
const certifications = [
  {
    title: "Quantium - Data Analytics Job Simulation",
    issuer: "Forage",
    issued: "Jun 2026",
    credentialId: "bwHLq7A4NdN98kJJx",
    href: "https://www.theforage.com/completion-certificates/32A6DqtsbF7LbKdcq/NkaC7knWtjSbi6aYv_32A6DqtsbF7LbKdcq_6a145487df290a68a05f2ebf_1780413335511_completion_certificate.pdf",
  },
  {
    title: "BCG - Introduction to Data for Decision Makers Job Simulation",
    issuer: "Forage",
    issued: "Jun 2026",
    credentialId: "YSrE38ZzN65XQEEqS",
    href: "https://www.theforage.com/completion-certificates/SKZxezskWgmFjRvj9/Pchc5rEGyCeozqY5Z_SKZxezskWgmFjRvj9_6a145487df290a68a05f2ebf_1780397819988_completion_certificate.pdf",
  },
  {
    title: "Enterprise Data Science in Practice",
    issuer: "IBM",
    issued: "Jan 2026",
    credentialId: "3d60d852-cac5-4c2b-95bc-690f71193c8e",
    href: "https://www.credly.com/badges/3d60d852-cac5-4c2b-95bc-690f71193c8e/public_url",
  },
  {
    title: "Data Fundamentals",
    issuer: "IBM",
    issued: "Jan 2026",
    credentialId: "85eaf9b3-d737-4ca8-b73a-b377e939c652",
    href: "https://www.credly.com/badges/85eaf9b3-d737-4ca8-b73a-b377e939c652/linked_in_profile",
  },
  {
    title: "Data Analytics - Digital Nova Scotia",
    issuer: "St. Francis Xavier University",
    issued: "Jun 2025",
    credentialId: "XRXdtqsZRLy-ORfRRz8KMA",
    href: "https://learner.mycreds.ca/badges/public/assertion/XRXdtqsZRLy-ORfRRz8KMA",
  },
  {
    title: "Skills For Hire Atlantic - Data Analytics",
    issuer: "Digital Nova Scotia",
    issued: "Jun 2025",
    credentialId: "003b655b-d5d1-4900-9e42-9d719058773c",
    href: "https://credsverse.com/credentials/003b655b-d5d1-4900-9e42-9d719058773c",
  },
];

export default function Certifications() {
  return (
    <section id="certifications" className="container py-20">
      <SectionReveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Certifications
          </h2>
          <p className="mt-3 text-muted-foreground">
            Verified training in data analytics, data science, and decision-making.
          </p>
        </div>
      </SectionReveal>

      {/* Center the carousel in a narrower column so each credential stays easy to scan. */}
      <SectionReveal className="mx-auto max-w-3xl">
        <AutoCarousel
          items={certifications}
          getKey={(certification) => certification.credentialId}
          label="Professional certifications"
          // Keep one certification visible at every breakpoint for a clear active state.
          itemClassName="basis-full"
          renderItem={(certification) => (
            <article className="group flex h-full flex-col glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Award className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold leading-snug">
                    {certification.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-primary/90">
                    {certification.issuer}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Issued {certification.issued}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-1 flex-col justify-end gap-4">
                <p className="break-all text-xs text-muted-foreground">
                  Credential ID: {certification.credentialId}
                </p>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <a href={certification.href} target="_blank" rel="noreferrer">
                    Show credential
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </article>
          )}
        />
      </SectionReveal>
    </section>
  );
}
