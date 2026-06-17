import { Sparkles } from "lucide-react";
import { SectionReveal } from "./SectionReveal";

// Warm, concise About section.
export default function About() {
  return (
    <section id="about" className="container py-20">
      <SectionReveal>
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full glass-subtle px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            About me
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            A bit about my background
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
            I have a background in <span className="text-foreground">Computer Science</span>, with hands-on
            experience in <span className="text-foreground">data analysis</span>,{" "}
            <span className="text-foreground">technical support</span>, IT systems, and everyday
            problem-solving. I enjoy learning, improving workflows, working with data, and using modern AI
            tools to build smarter, faster solutions for the people I work with.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Whether I'm cleaning a dataset, debugging a system, or shipping a small web app, my goal is the
            same: make something useful, reliable, and easy to use.
          </p>
        </div>
      </SectionReveal>
    </section>
  );
}
