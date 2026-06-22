import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, Bell, Home, User, Folder, FileText, Mail, MapPin, Globe,
  Github, Linkedin, ThumbsUp, MessageSquare, Share2, Award, Briefcase,
  Camera, StickyNote, Users, Wallet, Download, ExternalLink, Plus,
} from "lucide-react";
import avatarImg from "@/assets/joshua-avatar.png";

/* ──────────────────────────────────────────────────────────────
   Joshua Kivaria — Retro Social Profile Portfolio
   Inspired by early-2000s social network profile pages.
   Three-column desktop layout, stacks vertically on mobile.
   All retro tokens live in index.css under the `.retro` scope.
   ────────────────────────────────────────────────────────────── */

// Small reusable card shell with optional header strip + "Edit" affordance.
function RetroCard({
  title,
  edit,
  children,
  className = "",
}: {
  title?: string;
  edit?: string; // placeholder action label (e.g. "Edit", "See All")
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`retro-card ${className}`}>
      {title && (
        <header className="retro-card-header">
          <span className="uppercase tracking-wide">{title}</span>
          {edit && <a href="#" className="retro-link text-[11px] font-normal">{edit}</a>}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

// Animated avatar — gentle floating speech bubble + waving hand emoji overlay.
function AnimatedAvatar({ size = 96 }: { size?: number }) {
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <img
        src={avatarImg}
        alt="Illustrated avatar of Joshua Kivaria"
        width={size}
        height={size}
        className="rounded-sm border border-[hsl(var(--retro-border))] bg-white object-cover"
        style={{ width: size, height: size }}
      />
      {/* Friendly waving hand in the bottom-right corner */}
      <span
        className="retro-wave absolute -bottom-1 -right-1 text-xl select-none"
        aria-hidden="true"
        title="Hi!"
      >
        👋
      </span>
    </div>
  );
}

// Top navigation bar — slim navy header with logo, search, links, notification.
function TopNav() {
  return (
    <nav className="retro-nav sticky top-0 z-40 w-full">
      <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-3 py-1.5">
        {/* Brand mark */}
        <a href="#top" className="flex items-center gap-1.5 font-bold text-white">
          <span className="rounded-sm bg-white/15 px-2 py-0.5 text-[13px] tracking-tight">
            JK<span className="text-[hsl(45_95%_70%)]">.space</span>
          </span>
        </a>

        {/* Notification icon (nostalgic detail) */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-sm p-1 hover:bg-white/10"
        >
          <Bell className="h-4 w-4 text-white/90" />
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-[hsl(var(--retro-accent))] px-1 text-[9px] font-bold text-white">
            3
          </span>
        </button>

        {/* Search bar */}
        <div className="ml-2 flex max-w-md flex-1 items-center rounded-sm bg-white px-2">
          <Search className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
          <input
            type="search"
            placeholder="Search Joshua's portfolio"
            className="w-full bg-transparent px-2 py-1 text-[12px] text-[hsl(var(--retro-text))] outline-none placeholder:text-[hsl(var(--retro-muted))]"
          />
        </div>

        {/* Right-side nav links */}
        <ul className="ml-auto hidden items-center gap-1 text-[12px] font-semibold text-white md:flex">
          {[
            { label: "Home", href: "#top" },
            { label: "Profile", href: "#profile" },
            { label: "Projects", href: "#projects" },
            { label: "Resume", href: "#resume" },
            { label: "Contact", href: "#contact" },
          ].map((l) => (
            <li key={l.label}>
              <a href={l.href} className="rounded-sm px-2 py-1 hover:bg-white/10">{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// Left sidebar — profile mini-card, sidebar nav, about, friends/network.
function LeftSidebar() {
  // Profile sidebar nav items use the retro labels but link to in-page anchors.
  const sidebarNav = [
    { label: "Wall", href: "#wall" },
    { label: "About Me", href: "#about" },
    { label: "Photos / Projects", href: "#projects" },
    { label: "Notes / Resume", href: "#resume" },
    { label: "Friends / Network", href: "#network" },
  ];

  // Fictional "friends" placeholders representing Joshua's network.
  const network = [
    { name: "Recruiters", initial: "R", color: "bg-[hsl(215_70%_45%)]" },
    { name: "Developers", initial: "D", color: "bg-[hsl(142_55%_40%)]" },
    { name: "Data Analysts", initial: "A", color: "bg-[hsl(265_55%_50%)]" },
    { name: "IT Support Teams", initial: "I", color: "bg-[hsl(35_85%_45%)]" },
    { name: "Project Managers", initial: "P", color: "bg-[hsl(12_75%_50%)]" },
  ];

  return (
    <aside className="space-y-3">
      {/* Profile photo card */}
      <section className="retro-card overflow-hidden">
        <div className="flex flex-col items-center gap-2 p-3">
          <AnimatedAvatar size={150} />
        </div>
        <ul className="border-t border-[hsl(var(--retro-border))] text-[12px]">
          {sidebarNav.map((item) => (
            <li key={item.label} className="border-b border-[hsl(var(--retro-border))] last:border-b-0">
              <a
                href={item.href}
                className="retro-link flex items-center gap-1.5 px-3 py-1.5 hover:bg-[hsl(var(--retro-soft))]"
              >
                <span className="text-[hsl(var(--retro-muted))]">›</span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* About Me */}
      <RetroCard title="About Me" edit="Edit">
        <p className="text-[12px] leading-relaxed text-[hsl(var(--retro-text))]">
          I turn data into insights, solve problems with technology, and build tools that
          make life easier.
        </p>
        <dl className="mt-3 space-y-1.5 text-[12px]">
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3 w-3 flex-none text-[hsl(var(--retro-muted))]" />
            <span>Halifax, Nova Scotia</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Mail className="mt-0.5 h-3 w-3 flex-none text-[hsl(var(--retro-muted))]" />
            <a className="retro-link break-all" href="mailto:joshua.kivaria@example.com">
              joshua.kivaria@example.com
            </a>
          </div>
          <div className="flex items-start gap-1.5">
            <Globe className="mt-0.5 h-3 w-3 flex-none text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href="https://jkivaria.com" target="_blank" rel="noreferrer">
              jkivaria.com
            </a>
          </div>
        </dl>
      </RetroCard>

      {/* Friends / Network */}
      <RetroCard title={`Network (${network.length})`} edit="See All">
        <ul id="network" className="grid grid-cols-3 gap-2">
          {network.map((f) => (
            <li key={f.name} className="flex flex-col items-center text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-sm border border-[hsl(var(--retro-border))] text-sm font-bold text-white ${f.color}`}
                aria-hidden="true"
              >
                {f.initial}
              </div>
              <span className="mt-1 text-[10px] leading-tight text-[hsl(var(--retro-link))]">{f.name}</span>
            </li>
          ))}
        </ul>
      </RetroCard>
    </aside>
  );
}

// Center column — profile header, status composer, recent activity, projects, wall.
function CenterColumn() {
  const tabs = ["Wall", "About", "Skills", "Projects", "Resume"];
  const [activeTab, setActiveTab] = useState("Wall");

  // Recent activity feed entries (retro social style).
  const activity = [
    { text: "Joshua updated his project:", link: "Job Tracker Pro" },
    { text: "Joshua added", link: "Python, SQL, and React", suffix: "to his skills" },
    { text: "Joshua is now connected to", link: "GitHub" },
    { text: "Joshua uploaded his", link: "resume" },
  ];

  // Featured projects — Job Tracker Pro stays the showcase project.
  const projects = [
    {
      title: "Job Tracker Pro",
      date: "Jun 2026",
      desc: "Track applications, manage follow-ups, and get AI-powered insights.",
      to: "/app",
      links: [
        { label: "View Project", href: "/app" },
        { label: "GitHub Repo", href: "https://github.com/joshuakivaria" },
        { label: "Live Demo", href: "/app" },
      ],
      gradient: "from-[hsl(215_70%_30%)] to-[hsl(220_60%_18%)]",
      icon: <Briefcase className="h-8 w-8 text-white/85" />,
    },
    {
      title: "FAO Hand-in-Hand Platform",
      date: "Dec 2025",
      desc: "Geospatial data platform for sustainable development and data visualization.",
      links: [
        { label: "View Project", href: "#" },
        { label: "GitHub Repo", href: "#" },
      ],
      gradient: "from-[hsl(142_45%_35%)] to-[hsl(160_55%_22%)]",
      icon: <Globe className="h-8 w-8 text-white/85" />,
    },
    {
      title: "Grocery Deals Finder",
      date: "Oct 2025",
      desc: "Search grocery deals across stores, filter by budget, and export results.",
      links: [
        { label: "View Project", href: "#" },
        { label: "GitHub Repo", href: "#" },
      ],
      gradient: "from-[hsl(35_85%_45%)] to-[hsl(20_75%_35%)]",
      icon: <Wallet className="h-8 w-8 text-white/85" />,
    },
    {
      title: "Spam Detection Model",
      date: "Aug 2025",
      desc: "Machine learning model using NLP and TF-IDF to classify spam messages.",
      links: [
        { label: "View Project", href: "#" },
        { label: "GitHub Repo", href: "#" },
      ],
      gradient: "from-[hsl(265_50%_38%)] to-[hsl(285_45%_24%)]",
      icon: <FileText className="h-8 w-8 text-white/85" />,
    },
  ];

  return (
    <section id="profile" className="space-y-3">
      {/* Profile header card */}
      <section className="retro-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-[22px] leading-tight text-[hsl(var(--retro-navy))]">
              Joshua Kivaria
            </h1>
            <p className="mt-0.5 text-[12px] text-[hsl(var(--retro-muted))]">
              Data Analyst | Technical Support Specialist | Developer
            </p>
            <p className="mt-1 text-[12px] italic text-[hsl(var(--retro-text))]">
              “Driven by data. Tuned for support. Built to ship.”
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--retro-muted))]">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Halifax, Nova Scotia, Canada</span>
              <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> joshua.kivaria@example.com</span>
              <a className="retro-link inline-flex items-center gap-1" href="#about"><User className="h-3 w-3" /> Edit My Profile</a>
            </div>
          </div>
          {/* Launch the original Job Tracker app — preserves existing functionality. */}
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] px-2.5 py-1 text-[12px] font-semibold text-[hsl(var(--retro-navy))] hover:bg-white"
          >
            <Briefcase className="h-3.5 w-3.5" /> Launch Job Tracker
          </Link>
        </div>

        {/* Profile tabs */}
        <div className="mt-3 flex flex-wrap items-end gap-0.5 border-b border-[hsl(var(--retro-border))]">
          {tabs.map((t) => {
            const active = t === activeTab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`-mb-px rounded-t-sm border px-3 py-1 text-[12px] font-semibold transition-colors ${
                  active
                    ? "border-[hsl(var(--retro-border))] border-b-white bg-white text-[hsl(var(--retro-navy))]"
                    : "border-transparent text-[hsl(var(--retro-link))] hover:bg-[hsl(var(--retro-soft))]"
                }`}
              >
                {t}
              </button>
            );
          })}
          <button
            type="button"
            aria-label="Add tab"
            className="ml-1 -mb-px rounded-t-sm px-2 py-1 text-[hsl(var(--retro-muted))] hover:bg-[hsl(var(--retro-soft))]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status composer (portfolio-focused) */}
        <form
          className="mt-3 rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] p-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="text"
            placeholder="What am I building next?"
            className="w-full rounded-sm border border-[hsl(var(--retro-border))] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[hsl(var(--retro-link))]"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--retro-muted))]">
              <span>Attach:</span>
              <Camera className="h-3.5 w-3.5" />
              <FileText className="h-3.5 w-3.5" />
              <Folder className="h-3.5 w-3.5" />
              <Award className="h-3.5 w-3.5" />
            </div>
            <button
              type="submit"
              className="rounded-sm bg-[hsl(var(--retro-navy))] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[hsl(var(--retro-navy-deep))]"
            >
              Share Update
            </button>
          </div>
        </form>

        {/* Recent activity feed */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[hsl(var(--retro-muted))]">
            Recent Activity
          </div>
          <ul className="mt-1.5 space-y-1 text-[12px]">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-[hsl(var(--retro-link))]" />
                <span>
                  {a.text} <a href="#" className="retro-link font-semibold">{a.link}</a>
                  {"suffix" in a ? ` ${a.suffix}` : "."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured projects */}
      <RetroCard title="Featured Projects" edit="See All">
        <ul id="projects" className="divide-y divide-[hsl(var(--retro-border))]">
          {projects.map((p) => (
            <li key={p.title} className="flex gap-3 py-3 first:pt-1 last:pb-1">
              {/* Thumbnail placeholder — labeled gradient tile, easy to swap */}
              <div
                className={`flex h-20 w-28 flex-none items-center justify-center rounded-sm bg-gradient-to-br ${p.gradient}`}
                aria-label={`${p.title} thumbnail placeholder`}
              >
                {p.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-[hsl(var(--retro-link))]">{p.title}</h3>
                  <span className="text-[11px] text-[hsl(var(--retro-muted))]">{p.date}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[hsl(var(--retro-text))]">{p.desc}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
                  {p.links.map((l) =>
                    l.href.startsWith("/") ? (
                      <Link key={l.label} to={l.href} className="retro-link">{l.label}</Link>
                    ) : (
                      <a key={l.label} href={l.href} className="retro-link" target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    ),
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </RetroCard>

      {/* Wall — classic profile post */}
      <RetroCard title="Wall">
        <div id="wall" className="flex gap-2.5">
          <img
            src={avatarImg}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 flex-none rounded-sm border border-[hsl(var(--retro-border))] bg-white"
          />
          <div className="flex-1">
            <div className="text-[12px]">
              <a href="#" className="retro-link font-bold">Joshua Kivaria</a>{" "}
              <span>Just shipped a new update to Job Tracker Pro! 🚀 Making the job search more organized and smarter.</span>
            </div>
            <div className="mt-1 text-[11px] text-[hsl(var(--retro-muted))]">June 2 at 9:45 PM</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[hsl(var(--retro-link))]">
              <button className="inline-flex items-center gap-1 hover:underline"><ThumbsUp className="h-3 w-3" /> Like</button>
              <button className="inline-flex items-center gap-1 hover:underline"><MessageSquare className="h-3 w-3" /> Comment</button>
              <button className="inline-flex items-center gap-1 hover:underline"><Share2 className="h-3 w-3" /> Share</button>
              <span className="ml-auto text-[hsl(var(--retro-muted))]">24 others like this.</span>
            </div>
            <input
              type="text"
              placeholder="Write a comment…"
              className="mt-2 w-full rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] px-2 py-1 text-[12px] outline-none focus:border-[hsl(var(--retro-link))] focus:bg-white"
            />
          </div>
        </div>
      </RetroCard>
    </section>
  );
}

// Right column — welcome box (with animated avatar host), skills, certs, contact.
function RightSidebar() {
  const skills = [
    { name: "Data Analysis", level: 95 },
    { name: "SQL", level: 90 },
    { name: "Python", level: 90 },
    { name: "Technical Support", level: 90 },
    { name: "Web Development", level: 80 },
    { name: "Problem Solving", level: 95 },
  ];

  const certs = [
    { code: "IBM", title: "Data Analyst – Job Simulation (Forage)", issued: "Jun 2026" },
    { code: "IBM", title: "Enterprise Data Science in Practice", issued: "Jan 2026" },
    { code: "NS",  title: "Professional Software Development – Digital Nova Scotia", issued: "Dec 2024" },
    { code: "STFX", title: "Data Analytics – St. Francis Xavier University", issued: "Apr 2024" },
  ];

  return (
    <aside className="space-y-3">
      {/* Welcome box with animated host avatar + speech bubble */}
      <RetroCard title="Welcome to My Profile!" edit="Edit">
        <div className="flex items-start gap-3">
          <AnimatedAvatar size={64} />
          <div className="relative flex-1">
            <div
              className="retro-bubble relative rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(45_95%_94%)] p-2 text-[12px] leading-snug"
            >
              {/* Bubble arrow pointing back at the avatar */}
              <span className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 border-b border-l border-[hsl(var(--retro-border))] bg-[hsl(45_95%_94%)]" />
              Welcome to my profile! 👋
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed">
              Hey there! Thanks for stopping by. Feel free to check out my projects, experience, and resume.
            </p>
          </div>
        </div>
      </RetroCard>

      {/* Skills with horizontal progress bars */}
      <RetroCard title="Skills" edit="See All Skills">
        <ul id="skills" className="space-y-2">
          {skills.map((s) => (
            <li key={s.name}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span>{s.name}</span>
                <span className="text-[hsl(var(--retro-muted))]">{s.level}%</span>
              </div>
              <div className="retro-skill-bar mt-0.5">
                <div className="retro-skill-fill" style={{ width: `${s.level}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </RetroCard>

      {/* Certifications widget */}
      <RetroCard title="Certifications" edit="See All">
        <ul className="space-y-2 text-[12px]">
          {certs.map((c) => (
            <li key={c.title} className="flex items-start gap-2">
              <div className="flex h-8 w-10 flex-none items-center justify-center rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] text-[10px] font-bold text-[hsl(var(--retro-navy))]">
                {c.code}
              </div>
              <div className="min-w-0">
                <div className="font-semibold leading-tight text-[hsl(var(--retro-text))]">{c.title}</div>
                <div className="text-[10px] text-[hsl(var(--retro-muted))]">Issued: {c.issued}</div>
              </div>
            </li>
          ))}
        </ul>
      </RetroCard>

      {/* Contact info + resume download (preserves existing /resume.pdf) */}
      <RetroCard title="Contact Info" edit="Edit">
        <ul id="contact" className="space-y-1.5 text-[12px]">
          <li className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link break-all" href="mailto:joshua.kivaria@example.com">joshua.kivaria@example.com</a>
          </li>
          <li className="flex items-center gap-1.5">
            <Linkedin className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href="https://linkedin.com/in/joshuakivaria" target="_blank" rel="noreferrer">
              linkedin.com/in/joshuakivaria
            </a>
          </li>
          <li className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href="https://github.com/joshuakivaria" target="_blank" rel="noreferrer">
              github.com/joshuakivaria
            </a>
          </li>
          <li className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href="https://jkivaria.com" target="_blank" rel="noreferrer">jkivaria.com</a>
          </li>
        </ul>
        <a
          id="resume"
          href="/resume.pdf"
          download
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] px-2 py-1.5 text-[12px] font-semibold text-[hsl(var(--retro-navy))] hover:bg-white"
        >
          <Download className="h-3.5 w-3.5" /> Download Resume
        </a>
      </RetroCard>
    </aside>
  );
}

// Retro footer — slim grey strip with classic profile-page links.
function RetroFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[hsl(var(--retro-border))] bg-white">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-[hsl(var(--retro-muted))]">
        <span>JK Space © {year} · English (US)</span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {["About", "Projects", "Resume", "Contact", "Privacy", "Terms", "Help"].map((l) => (
            <li key={l}><a href="#" className="retro-link">{l}</a></li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

export default function Portfolio() {
  // Light-mode body for this page — force-remove `dark` class while mounted so
  // next-themes (system default) can't repaint the retro layout in dark tokens.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => { if (hadDark) root.classList.add("dark"); };
  }, []);

  return (
    <div id="top" className="retro min-h-screen">
      <TopNav />
      <main className="mx-auto grid max-w-[1100px] gap-3 px-3 py-3 lg:grid-cols-[220px_1fr_260px]">
        <LeftSidebar />
        <CenterColumn />
        <RightSidebar />
      </main>
      <RetroFooter />
    </div>
  );
}
