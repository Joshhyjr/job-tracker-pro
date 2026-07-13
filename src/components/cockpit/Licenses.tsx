import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXTERNAL_LINK_REL } from "@/lib/security";
import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";

const certs = [
  {
    title: "Quantium · Data Analytics Job Simulation",
    issuer: "Forage",
    date: "JUN 2026",
    id: "bwHLq7A4NdN98kJJx",
    href: "https://www.theforage.com/completion-certificates/32A6DqtsbF7LbKdcq/NkaC7knWtjSbi6aYv_32A6DqtsbF7LbKdcq_6a145487df290a68a05f2ebf_1780413335511_completion_certificate.pdf",
  },
  {
    title: "BCG · Data for Decision Makers",
    issuer: "Forage",
    date: "JUN 2026",
    id: "YSrE38ZzN65XQEEqS",
    href: "https://www.theforage.com/completion-certificates/SKZxezskWgmFjRvj9/Pchc5rEGyCeozqY5Z_SKZxezskWgmFjRvj9_6a145487df290a68a05f2ebf_1780397819988_completion_certificate.pdf",
  },
  {
    title: "Enterprise Data Science in Practice",
    issuer: "IBM",
    date: "JAN 2026",
    id: "3d60d852-cac5-4c2b-95bc-690f71193c8e",
    href: "https://www.credly.com/badges/3d60d852-cac5-4c2b-95bc-690f71193c8e/public_url",
  },
  {
    title: "Data Fundamentals",
    issuer: "IBM",
    date: "JAN 2026",
    id: "85eaf9b3-d737-4ca8-b73a-b377e939c652",
    href: "https://www.credly.com/badges/85eaf9b3-d737-4ca8-b73a-b377e939c652/linked_in_profile",
  },
  {
    title: "Data Analytics · Digital Nova Scotia",
    issuer: "St. Francis Xavier University",
    date: "JUN 2025",
    id: "XRXdtqsZRLy-ORfRRz8KMA",
    href: "https://learner.mycreds.ca/badges/public/assertion/XRXdtqsZRLy-ORfRRz8KMA",
  },
  {
    title: "Skills For Hire Atlantic · Data Analytics",
    issuer: "Digital Nova Scotia",
    date: "JUN 2025",
    id: "003b655b-d5d1-4900-9e42-9d719058773c",
    href: "https://credsverse.com/credentials/003b655b-d5d1-4900-9e42-9d719058773c",
  },
];

export default function Licenses() {
  return (
    <SectionPanel
      id="licenses"
      eyebrow="05 · Licenses & Upgrades"
      title="Verified credentials"
      description="Training and credentials that back the skills above — all verifiable."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {certs.map((c, idx) => (
          <SectionReveal key={c.id} delay={(idx % 3) * 80}>
            <article className="glass-subtle flex h-full flex-col rounded-xl p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {c.date} · {c.issuer}
              </div>
              <h3 className="mt-2 font-display text-base font-semibold leading-snug">
                {c.title}
              </h3>
              <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground/80">
                ID · {c.id}
              </p>
              <div className="mt-auto pt-4">
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <a href={c.href} target="_blank" rel={EXTERNAL_LINK_REL}>
                    Verify <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </article>
          </SectionReveal>
        ))}
      </div>
    </SectionPanel>
  );
}
