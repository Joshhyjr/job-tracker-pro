import { Download, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedAvatar from "./AnimatedAvatar";

// Hero / welcome section with headline, intro, CTAs, and animated avatar.
export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Ambient indigo glow background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-0 top-40 h-[300px] w-[300px] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="container grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full glass-subtle px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
            Available for new opportunities
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Hi, I'm{" "}
            <span className="bg-gradient-to-r from-primary via-indigo-300 to-indigo-100 bg-clip-text text-transparent">
              Joshua Kivaria
            </span>
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Data Analyst <span className="text-primary">•</span> Technical Support Specialist{" "}
            <span className="text-primary">•</span> Developer
          </p>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Passionate about technology, data, problem-solving, automation, and building useful digital tools.
            I turn messy data into clear insights, fix things that are broken, and ship apps that make real
            workflows feel easier.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" className="group">
              <a href="#projects">
                View My Work
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              {/* Downloads the public resume copy with direct contact PII redacted. */}
              <a href="/resume.pdf" download>
                <Download /> Download Resume
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#contact">
                <Mail /> Contact Me
              </a>
            </Button>
          </div>
        </div>

        <div className="relative">
          <AnimatedAvatar />
        </div>
      </div>
    </section>
  );
}
