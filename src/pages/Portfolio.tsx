import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Search, Bell, Home, User, Folder, FileText, MapPin,
  Github, Linkedin, ThumbsUp, MessageSquare, Share2, Award, Briefcase,
  Camera, StickyNote, Users, Download, ExternalLink, Plus, Send,
} from "lucide-react";
import avatarImg from "@/assets/joshua-avatar.png";
import { EXTERNAL_LINK_REL } from "@/lib/security";

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
    { label: "Projects", href: "#projects" },
    { label: "Resume", href: "#resume" },
   // { label: "Friends / Network", href: "#network" },
  ];

  // Personal interests add a little life beyond the professional portfolio.
  const interests = [
    "🚗 F1",
    "🎧 Music",
    "⚽ Football",
    "🎬 Movies & Series",
    "🛠️ Building things for fun",
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
          I built this space to share my journey across data analytics, technical support
          &amp; the few times I&apos;ve tinkered with software development. Here you&apos;ll
          find the projects I&apos;ve built, tools I&apos;m learning &amp; what experience I bring.
        </p>
      </RetroCard>

      {/* A quick glimpse of Joshua's interests away from work. */}
      <RetroCard title="Outside the Terminal">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-[hsl(var(--retro-text))]">
          {interests.map((interest, index) => (
            <li
              key={interest}
              className={index === interests.length - 1 ? "col-span-2" : undefined}
            >
              {interest}
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
    { text: "Joshua updated his project:", link: "Job Tracker" },
    { text: "Joshua added", link: "Python, SQL, and React", suffix: "to his skills" },
    { text: "Joshua is now connected to", link: "GitHub" },
    { text: "Joshua uploaded his", link: "resume" },
  ];

  // Featured projects use live destinations where available and clearly label archived work.
  const projects = [
    {
      title: "Job Tracker",
      date: "Jun 2026",
      desc: "Track applications, manage follow-ups, and get AI-powered insights.",
      to: "/app",
      links: [
        { label: "View Project", href: "/app" },
        { label: "GitHub Repo", href: "https://github.com/Joshhyjr/job-tracker-pro" },
        { label: "Live Demo", href: "/app" },
      ],
      preview: "/project-screenshots/job-tracker.png",
      previewAlt: "Job Tracker dashboard with application totals and status charts",
    },
    {
      title: "FAO Hand-in-Hand Platform",
      date: "Dec 2025",
      desc: "Geospatial data platform for sustainable development and data visualization.",
      links: [
        { label: "View Platform", href: "https://data.apps.fao.org/?lang=en" },
      ],
      preview: "/project-screenshots/fao-hand-in-hand.png",
      previewAlt: "FAO Hand-in-Hand geospatial platform showing its map interface",
    },
    {
      title: "Grocery Deals Finder",
      date: "Oct 2025",
      desc: "Search grocery deals across stores, filter by budget, and export results.",
      links: [
        { label: "Live Demo", href: "https://joshhyjr.github.io/Grocerydealsfinder/" },
        { label: "GitHub Repo", href: "https://github.com/Joshhyjr/Grocerydealsfinder" },
      ],
      preview: "/project-screenshots/grocery-deals-finder.png",
      previewAlt: "Grocery Deals Finder landing page with its budget and grocery list form",
    },
    {
      title: "Spam Detection Model",
      date: "Aug 2025",
      status: "Archived",
      desc: "Machine learning model using NLP and TF-IDF to classify spam messages.",
      links: [
        { label: "View Archived Repo", href: "https://github.com/Joshhyjr/SpamFilter" },
      ],
      preview: "/project-screenshots/spam-detection-model.svg",
      previewAlt: "Spam detection model preview classifying messages as safe or spam",
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
            {/* Concise role summary reflects Joshua's analytical and hands-on strengths. */}
            <p className="mt-0.5 text-[12px] text-[hsl(var(--retro-muted))]">
              Data Analyst · Tech Support Problem-Solver · Builder
            </p>
            <p className="mt-1 text-[12px] italic text-[hsl(var(--retro-text))]">
              “I’ve got 99 problems, but messy data won’t be one.”
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--retro-muted))]">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Halifax, Nova Scotia, Canada</span>
              <a className="retro-link inline-flex items-center gap-1" href="#about"><User className="h-3 w-3" /> Edit My Profile</a>
            </div>
          </div>
          {/* Keep the primary project and resume actions visible near the profile heading. */}
          <div className="flex flex-wrap items-center gap-2">
              <a
                href="/resume.pdf"
                target="_blank"
                rel={EXTERNAL_LINK_REL}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--retro-border))] bg-white px-2.5 py-1 text-[12px] font-semibold text-[hsl(var(--retro-navy))] hover:bg-[hsl(var(--retro-soft))]"
              >
              <FileText className="h-3.5 w-3.5" /> View Resume
            </a>
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] px-2.5 py-1 text-[12px] font-semibold text-[hsl(var(--retro-navy))] hover:bg-white"
            >
              <Briefcase className="h-3.5 w-3.5" /> Launch Job Tracker
            </Link>
          </div>
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
            <li key={p.title} className="flex flex-col gap-3 py-3 first:pt-1 last:pb-1 sm:flex-row">
              {/* Real project captures make each item immediately recognizable. */}
              <div className="aspect-video w-full flex-none overflow-hidden rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] shadow-sm sm:w-40">
                <img
                  src={p.preview}
                  alt={p.previewAlt}
                  loading="lazy"
                  className="h-full w-full object-cover object-top transition-transform duration-200 hover:scale-[1.02]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[14px] font-bold text-[hsl(var(--retro-link))]">{p.title}</h3>
                    {"status" in p ? (
                      <span className="rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--retro-muted))]">
                        {p.status}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-[hsl(var(--retro-muted))]">{p.date}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[hsl(var(--retro-text))]">{p.desc}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
                  {p.links.map((l) =>
                    l.href.startsWith("/") ? (
                      <Link key={l.label} to={l.href} className="retro-link">{l.label}</Link>
                    ) : (
                      <a key={l.label} href={l.href} className="retro-link" target="_blank" rel={EXTERNAL_LINK_REL}>
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
              {/* Keep the wall current with active professional-development work. */}
              <span>
                Just shipped a new update to Job Tracker! 🚀 Making the job search more organized and smarter.
                I&apos;m currently learning Power BI &amp; Tableau to build even stronger dashboards and data stories.
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[hsl(var(--retro-muted))]">June 22, 2026 at 9:45 PM</div>
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

// Skills are paired with concrete evidence so proficiency claims stay specific and interview-ready.
const skillsWithEvidence = [
  {
    name: "Data Analysis",
    tools: "Python · pandas · NumPy · Matplotlib",
    evidence: "IBM OPOR Data Analyst role (Experis) and Quantium simulation (Forage)",
  },
  {
    name: "Decision Support",
    tools: "Excel · data storytelling · recommendations",
    evidence: "BCG Data for Decision Makers simulation (Forage)",
  },
  {
    name: "SQL & Reporting",
    tools: "SQL · Tableau · dashboards · data cleaning",
    evidence: "StFX and Digital Nova Scotia data analytics training",
  },
  {
    name: "Technical Support",
    tools: "Troubleshooting · Active Directory · Azure · documentation",
    evidence: "End User Support Technician role at Saint Mary's University",
  },
  {
    name: "Frontend Development",
    tools: "React · TypeScript · Vite · Git/GitHub",
    evidence: "Job Tracker and Grocery Deals Finder",
  },
  {
    name: "Data Validation",
    tools: "Dataset review · quality checks · geospatial platforms",
    evidence: "FAO Hand-in-Hand Platform internship",
  },
];

// Certification metadata includes verification links already used by the prior portfolio design.
const certifications = [
  {
    code: "QNT",
    title: "Quantium – Data Analytics Job Simulation",
    issued: "Jun 2026",
    href: "https://www.theforage.com/completion-certificates/32A6DqtsbF7LbKdcq/NkaC7knWtjSbi6aYv_32A6DqtsbF7LbKdcq_6a145487df290a68a05f2ebf_1780413335511_completion_certificate.pdf",
  },
  {
    code: "BCG",
    title: "BCG – Data for Decision Makers",
    issued: "Jun 2026",
    href: "https://www.theforage.com/completion-certificates/SKZxezskWgmFjRvj9/Pchc5rEGyCeozqY5Z_SKZxezskWgmFjRvj9_6a145487df290a68a05f2ebf_1780397819988_completion_certificate.pdf",
  },
  {
    code: "IBM",
    title: "Enterprise Data Science in Practice",
    issued: "Jan 2026",
    href: "https://www.credly.com/badges/3d60d852-cac5-4c2b-95bc-690f71193c8e/public_url",
  },
  {
    code: "STFX",
    title: "Data Analytics – Digital Nova Scotia",
    issued: "Jun 2025",
    href: "https://learner.mycreds.ca/badges/public/assertion/XRXdtqsZRLy-ORfRRz8KMA",
  },
];

// Right column — welcome box (with animated avatar host), skills, certs, contact.
function RightSidebar() {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [contactFeedback, setContactFeedback] = useState("");

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactStatus("sending");
    setContactFeedback("");

    try {
      // The recipient and provider credentials remain on the server in /api/contact.
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Message could not be sent right now.");
      }

      setContactName("");
      setContactEmail("");
      setContactMessage("");
      setContactStatus("sent");
      setContactFeedback("Message sent. Thanks for reaching out!");
    } catch (error) {
      setContactStatus("error");
      setContactFeedback(error instanceof Error ? error.message : "Message could not be sent right now.");
    }
  }

  return (
    <aside className="space-y-3">
      {/* Personal introduction frames the portfolio around Joshua's multidisciplinary journey. */}
      <RetroCard title="Hello World" edit="Edit">
        <div className="flex items-start gap-3">
          <AnimatedAvatar size={64} />
          <div className="relative flex-1">
            <div
              className="retro-bubble relative rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(45_95%_94%)] p-2 text-[12px] leading-snug"
            >
              {/* Bubble arrow pointing back at the avatar */}
              <span className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 border-b border-l border-[hsl(var(--retro-border))] bg-[hsl(45_95%_94%)]" />
              Hello world, 👋
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed">
              Welcome to JK.space — part portfolio, part digital scrapbook, and part proof
              that I&apos;m always learning, building, and improving.
            </p>
          </div>
        </div>
      </RetroCard>

      {/* Evidence-backed skills replace arbitrary percentage ratings with tools and proof of use. */}
      <RetroCard title="Skills + Evidence" edit="View Projects">
        <ul id="skills" className="divide-y divide-[hsl(var(--retro-border))]">
          {skillsWithEvidence.map((s) => (
            <li key={s.name} className="py-2 first:pt-0 last:pb-0">
              <div className="text-[12px] font-semibold text-[hsl(var(--retro-text))]">{s.name}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--retro-muted))]">
                {s.tools}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-[hsl(var(--retro-link))]">
                Evidence: {s.evidence}
              </div>
            </li>
          ))}
        </ul>
      </RetroCard>

      {/* Certifications widget */}
      <RetroCard title="Certifications" edit="See All">
        <ul className="space-y-2 text-[12px]">
          {certifications.map((c) => (
            <li key={c.title} className="flex items-start gap-2">
              <div className="flex h-8 w-10 flex-none items-center justify-center rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] text-[10px] font-bold text-[hsl(var(--retro-navy))]">
                {c.code}
              </div>
              <div className="min-w-0">
                  <a
                    href={c.href}
                    target="_blank"
                    rel={EXTERNAL_LINK_REL}
                    className="retro-link font-semibold leading-tight"
                  >
                  {c.title}
                </a>
                <div className="text-[10px] text-[hsl(var(--retro-muted))]">Issued: {c.issued}</div>
              </div>
            </li>
          ))}
        </ul>
      </RetroCard>

      {/* Contact form sends through the server endpoint instead of exposing a personal email address. */}
      <RetroCard title="Contact Me">
        <form id="contact" onSubmit={handleContactSubmit} className="space-y-2">
          <div>
            <label htmlFor="contact-name" className="text-[11px] font-semibold">Name</label>
            <input
              id="contact-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
              maxLength={120}
              className="mt-0.5 w-full rounded-sm border border-[hsl(var(--retro-border))] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[hsl(var(--retro-link))]"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="text-[11px] font-semibold">Email</label>
            <input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              required
              maxLength={254}
              className="mt-0.5 w-full rounded-sm border border-[hsl(var(--retro-border))] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[hsl(var(--retro-link))]"
            />
          </div>
          <div>
            <label htmlFor="contact-message" className="text-[11px] font-semibold">Message</label>
            <textarea
              id="contact-message"
              value={contactMessage}
              onChange={(event) => setContactMessage(event.target.value)}
              required
              maxLength={3000}
              rows={4}
              className="mt-0.5 w-full resize-y rounded-sm border border-[hsl(var(--retro-border))] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[hsl(var(--retro-link))]"
            />
          </div>
          <button
            type="submit"
            disabled={contactStatus === "sending"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-[hsl(var(--retro-navy))] px-2 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {contactStatus === "sending" ? "Sending..." : "Send Message"}
          </button>
          {contactFeedback ? (
            <p
              role="status"
              className={`text-[11px] leading-snug ${
                contactStatus === "sent" ? "text-green-700" : "text-red-700"
              }`}
            >
              {contactFeedback}
            </p>
          ) : null}
        </form>
        <ul className="mt-3 space-y-1.5 border-t border-[hsl(var(--retro-border))] pt-3 text-[12px]">
          <li className="flex items-center gap-1.5">
            <Linkedin className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href="https://www.linkedin.com/in/joshua-kivaria/" target="_blank" rel={EXTERNAL_LINK_REL}>
              LinkedIn
            </a>
          </li>
          <li className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href="https://github.com/Joshhyjr" target="_blank" rel={EXTERNAL_LINK_REL}>
              GitHub
            </a>
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
