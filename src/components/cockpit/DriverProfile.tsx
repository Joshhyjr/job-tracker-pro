import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";

// Compact stat readout — key/value pair, mono numerals.
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-subtle rounded-lg p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-base font-medium text-foreground">{value}</div>
    </div>
  );
}

export default function DriverProfile() {
  return (
    <SectionPanel
      id="driver"
      eyebrow="01 · Driver Profile"
      title="About the driver"
      description="A short read on how I work and what I bring to a team."
    >
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <SectionReveal>
          <div className="space-y-5 text-base leading-relaxed text-foreground/85">
            <p>
              Forged through a <span className="text-foreground">Computer Science</span> education
              and strengthened by hands-on work in{" "}
              <span className="text-foreground">data analysis</span>,{" "}
              <span className="text-foreground">technical support</span>, and IT systems, I bring a
              steady, practical approach to complex problems.
            </p>
            <p>
              Whether I'm cleaning a messy dataset, unblocking a user, or shipping a small product,
              the goal is the same: make the next decision easier and faster than the last one.
            </p>
          </div>
        </SectionReveal>

        <SectionReveal delay={120}>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Based in" value="Halifax, NS" />
            <StatCard label="Focus" value="Data + Support" />
            <StatCard label="Currently" value="IBM OPOR (Experis)" />
            <StatCard label="Open to" value="Full-time roles" />
          </div>
        </SectionReveal>
      </div>
    </SectionPanel>
  );
}
