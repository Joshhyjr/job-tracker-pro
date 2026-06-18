// Polished portfolio footer with quick links.
const quickLinks = [
  { href: "#about", label: "About" },
  { href: "#skills", label: "Skills" },
  // Mirror the new section in the footer's quick navigation.
  { href: "#certifications", label: "Certifications" },
  { href: "#projects", label: "Projects" },
  { href: "#resume", label: "Resume" },
  { href: "#contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border/40 mt-10">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground md:flex-row">
        <p>
          Designed and built by{" "}
          <span className="bg-gradient-to-r from-primary to-indigo-300 bg-clip-text font-medium text-transparent">
            Joshua Kivaria
          </span>
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {quickLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <p className="text-xs">© {new Date().getFullYear()} jkivaria.com</p>
      </div>
    </footer>
  );
}
