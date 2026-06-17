import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sticky glass navigation with smooth-scroll anchor links to portfolio sections.
const sections = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "resume", label: "Resume" },
  { id: "contact", label: "Contact" },
];

export default function PortfolioNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 glass rounded-none border-x-0 border-t-0 transition-shadow ${
        scrolled ? "shadow-lg shadow-primary/5" : ""
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Brand wordmark */}
        <a
          href="#top"
          className="text-lg font-semibold tracking-tight font-display"
        >
          <span className="bg-gradient-to-r from-primary to-indigo-300 bg-clip-text text-transparent">
            Joshua Kivaria
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
          <Button asChild size="sm" variant="outline" className="ml-2">
            <Link to="/app">Try Job Tracker</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <div className="glass-subtle rounded-none border-x-0 border-b p-4 md:hidden">
          <div className="flex flex-col gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/app" onClick={() => setOpen(false)}>Try Job Tracker</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
