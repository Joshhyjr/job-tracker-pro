import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Search, Bell, Home, User, Folder, FileText, MapPin,
  Github, Linkedin, ThumbsUp, MessageSquare, Share2, Award, Briefcase,
  Camera, StickyNote, Users, Download, ExternalLink, Plus, Send, LogIn, LogOut, Pencil,
} from "lucide-react";
import avatarImg from "@/assets/joshua-avatar.png";
import { useAuth } from "@/contexts/AuthContext";
import {
  FALLBACK_PORTFOLIO_CONTENT,
  formatPortfolioDateTime,
  formatPortfolioMonth,
  resolvePortfolioContent,
  type PortfolioPageContent,
} from "@/lib/portfolioContent";
import { loadPortfolioContent, savePortfolioContent } from "@/lib/portfolioRepository";
import type { PortfolioEditSection } from "@/components/PortfolioEditor";

// The editor and dialog libraries stay out of the public visitor bundle until an owner session exists.
const PortfolioEditor = lazy(() => import("@/components/PortfolioEditor").then((module) => ({
  default: module.PortfolioEditor,
})));

/* ──────────────────────────────────────────────────────────────
   Joshua Kivaria — Retro Social Profile Portfolio
   Inspired by early-2000s social network profile pages.
   Three-column desktop layout, stacks vertically on mobile.
   All retro tokens live in index.css under the `.retro` scope.
   ────────────────────────────────────────────────────────────── */

// Small reusable card shell with optional header strip + "Edit" affordance.
function RetroCard({
  title,
  hint,
  onEdit,
  children,
  className = "",
}: {
  title?: string;
  hint?: string; // non-interactive guidance for contained widgets
  onEdit?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`retro-card ${className}`}>
      {title && (
        <header className="retro-card-header">
          <span className="uppercase tracking-wide">{title}</span>
          {onEdit ? (
            <button type="button" onClick={onEdit} className="retro-link inline-flex items-center gap-1 text-[11px] font-normal normal-case"><Pencil className="h-3 w-3" /> Edit</button>
          ) : hint ? (
            <span className="text-[10px] font-normal normal-case text-[hsl(var(--retro-muted))]">{hint}</span>
          ) : null}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

// Animated avatar — gentle floating speech bubble + waving hand emoji overlay.
function AnimatedAvatar({ name, size = 96 }: { name: string; size?: number }) {
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <img
        src={avatarImg}
        alt={`Illustrated avatar of ${name}`}
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
function TopNav({
  profileName,
  signedIn,
  authLoading,
  onEdit,
  onSignIn,
  onSignOut,
}: {
  profileName: string;
  signedIn: boolean;
  authLoading: boolean;
  onEdit: () => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
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
            placeholder={`Search ${profileName}'s portfolio`}
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
        {/* Authentication controls are separate from public navigation and reveal editing only to the approved account. */}
        {signedIn ? (
          <div className="ml-auto flex items-center gap-1 md:ml-1">
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-sm bg-white/15 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/25">
              <Pencil className="h-3 w-3" /> Edit page
            </button>
            <button type="button" aria-label="Sign out" onClick={onSignOut} className="rounded-sm p-1 text-white/90 hover:bg-white/10">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button type="button" disabled={authLoading} onClick={onSignIn} className="ml-auto inline-flex items-center gap-1 rounded-sm bg-white/15 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-60 md:ml-1">
            <LogIn className="h-3 w-3" /> Owner sign in
          </button>
        )}
      </div>
    </nav>
  );
}

// Left sidebar — profile mini-card, sidebar nav, about, friends/network.
function LeftSidebar({ content, onEdit }: { content: PortfolioPageContent; onEdit?: (section: PortfolioEditSection) => void }) {
  // Profile sidebar nav items use the retro labels but link to in-page anchors.
  const sidebarNav = [
    { label: "Wall", href: "#wall" },
    { label: "About Me", href: "#about" },
    { label: "Projects", href: "#projects" },
    { label: "Resume", href: "#resume" },
   // { label: "Friends / Network", href: "#network" },
  ];

  return (
    <aside className="space-y-3">
      {/* Profile photo card */}
      <section className="retro-card overflow-hidden">
        <div className="flex flex-col items-center gap-2 p-3">
          <AnimatedAvatar name={content.profile.name} size={150} />
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
      <RetroCard title="About Me" onEdit={onEdit ? () => onEdit("about") : undefined}>
        <p className="text-[12px] leading-relaxed text-[hsl(var(--retro-text))]">
          {content.profile.about}
        </p>
      </RetroCard>

      {/* A quick glimpse of Joshua's interests away from work. */}
      <RetroCard title="Outside the Terminal" onEdit={onEdit ? () => onEdit("about") : undefined}>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-[hsl(var(--retro-text))]">
          {content.interests.map((interest, index) => (
            <li
              key={interest.id}
              className={index === content.interests.length - 1 ? "col-span-2" : undefined}
            >
              {interest.text}
            </li>
          ))}
        </ul>
      </RetroCard>
    </aside>
  );
}

// Center column — profile header, status composer, recent activity, projects, wall.
function CenterColumn({ content, onEdit }: { content: PortfolioPageContent; onEdit?: (section: PortfolioEditSection) => void }) {
  const tabs = ["Wall", "About", "Skills", "Projects", "Resume"];
  const [activeTab, setActiveTab] = useState("Wall");
  // Keep the render boundary safe if Fast Refresh supplies state from an older module shape.
  const projects = Array.isArray(content.projects) ? content.projects : FALLBACK_PORTFOLIO_CONTENT.projects;

  return (
    <section id="profile" className="space-y-3">
      {/* Profile header card */}
      <section className="retro-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-[22px] leading-tight text-[hsl(var(--retro-navy))]">
              {content.profile.name}
            </h1>
            {/* Concise role summary reflects Joshua's analytical and hands-on strengths. */}
            <p className="mt-0.5 text-[12px] text-[hsl(var(--retro-muted))]">
              {content.profile.headline}
            </p>
            <p className="mt-1 text-[12px] italic text-[hsl(var(--retro-text))]">
              “{content.profile.quote}”
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--retro-muted))]">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {content.profile.location}</span>
              {onEdit ? <button type="button" className="retro-link inline-flex items-center gap-1" onClick={() => onEdit("profile")}><User className="h-3 w-3" /> Edit profile</button> : null}
            </div>
          </div>
          {/* Keep the primary project and resume actions visible near the profile heading. */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/resume.pdf"
              target="_blank"
              rel="noreferrer"
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
            placeholder={content.profile.statusPrompt}
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
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-[hsl(var(--retro-muted))]">
            <span>Recent Activity</span>
            {onEdit ? <button type="button" className="retro-link inline-flex items-center gap-1 font-normal normal-case" onClick={() => onEdit("activity")}><Pencil className="h-3 w-3" /> Edit</button> : null}
          </div>
          <ul className="mt-1.5 space-y-1 text-[12px]">
            {content.activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-1.5">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-[hsl(var(--retro-link))]" />
                <span>
                  {activity.prefix} <span className="retro-link font-semibold">{activity.highlight}</span>
                  {activity.suffix ? ` ${activity.suffix}` : "."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured projects */}
      <RetroCard title="Featured Projects" hint="Scroll to explore ↓" onEdit={onEdit ? () => onEdit("projects") : undefined}>
        <ul
          id="projects"
          aria-label="Featured projects"
          tabIndex={0}
          // The viewport-aware panel keeps the expanded project collection from lengthening the whole page.
          className="retro-projects-scroll divide-y divide-[hsl(var(--retro-border))] pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--retro-link))]"
        >
          {projects.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 py-3 first:pt-1 last:pb-1 sm:flex-row">
              {/* New cloud projects remain presentable without accepting arbitrary remote image sources. */}
              {p.preview ? (
                <div className="aspect-video w-full flex-none overflow-hidden rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] shadow-sm sm:w-40">
                  <img
                    src={p.preview}
                    alt={p.previewAlt ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition-transform duration-200 hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <div aria-hidden="true" className="flex aspect-video w-full flex-none items-center justify-center rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--retro-muted))] sm:w-40">
                  Project
                </div>
              )}
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
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-[hsl(var(--retro-muted))]">{formatPortfolioMonth(p.date)}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[hsl(var(--retro-text))]">{p.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
                  {(Array.isArray(p.links) ? p.links : []).map((l, linkIndex) =>
                    l.href.startsWith("/") ? (
                      <Link key={`${p.id}-link-${linkIndex}`} to={l.href} className="retro-link">{l.label}</Link>
                    ) : (
                      <a key={`${p.id}-link-${linkIndex}`} href={l.href} className="retro-link" target="_blank" rel="noreferrer">
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
      <RetroCard title="Wall" onEdit={onEdit ? () => onEdit("activity") : undefined}>
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
              <span className="retro-link font-bold">{content.profile.name}</span>{" "}
              {/* Keep the wall current with active professional-development work. */}
              <span>{content.profile.wallPost}</span>
            </div>
            <div className="mt-1 text-[11px] text-[hsl(var(--retro-muted))]">{formatPortfolioDateTime(content.profile.wallDate)}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[hsl(var(--retro-link))]">
              <button className="inline-flex items-center gap-1 hover:underline"><ThumbsUp className="h-3 w-3" /> Like</button>
              <button className="inline-flex items-center gap-1 hover:underline"><MessageSquare className="h-3 w-3" /> Comment</button>
              <button className="inline-flex items-center gap-1 hover:underline"><Share2 className="h-3 w-3" /> Share</button>
              <span className="ml-auto text-[hsl(var(--retro-muted))]">{content.profile.wallLikes}</span>
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
function RightSidebar({ content, onEdit }: { content: PortfolioPageContent; onEdit?: (section: PortfolioEditSection) => void }) {
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
      <RetroCard title="Hello World" onEdit={onEdit ? () => onEdit("about") : undefined}>
        <div className="flex items-start gap-3">
          <AnimatedAvatar name={content.profile.name} size={64} />
          <div className="relative flex-1">
            <div
              className="retro-bubble relative rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(45_95%_94%)] p-2 text-[12px] leading-snug"
            >
              {/* Bubble arrow pointing back at the avatar */}
              <span className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 border-b border-l border-[hsl(var(--retro-border))] bg-[hsl(45_95%_94%)]" />
              {content.profile.greeting}
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed">
              {content.profile.introduction}
            </p>
          </div>
        </div>
      </RetroCard>

      {/* Evidence-backed skills replace arbitrary percentage ratings with tools and proof of use. */}
      <RetroCard title="Skills + Evidence" onEdit={onEdit ? () => onEdit("skills") : undefined}>
        <ul id="skills" className="divide-y divide-[hsl(var(--retro-border))]">
          {content.skills.map((s) => (
            <li key={s.id} className="py-2 first:pt-0 last:pb-0">
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
      <RetroCard title="Certifications" onEdit={onEdit ? () => onEdit("certifications") : undefined}>
        <ul className="space-y-2 text-[12px]">
          {content.certifications.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <div className="flex h-8 w-10 flex-none items-center justify-center rounded-sm border border-[hsl(var(--retro-border))] bg-[hsl(var(--retro-soft))] text-[10px] font-bold text-[hsl(var(--retro-navy))]">
                {c.code}
              </div>
              <div className="min-w-0">
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="retro-link font-semibold leading-tight"
                >
                  {c.title}
                </a>
                <div className="text-[10px] text-[hsl(var(--retro-muted))]">Issued: {formatPortfolioMonth(c.issued)}</div>
              </div>
            </li>
          ))}
        </ul>
      </RetroCard>

      {/* Contact form sends through the server endpoint instead of exposing a personal email address. */}
      <RetroCard title="Contact Me" onEdit={onEdit ? () => onEdit("profile") : undefined}>
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
            <a className="retro-link" href={content.profile.linkedinHref} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </li>
          <li className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5 text-[hsl(var(--retro-muted))]" />
            <a className="retro-link" href={content.profile.githubHref} target="_blank" rel="noreferrer">
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
  const { user, loading: authLoading, error: authError, signInWithGoogle, signOut } = useAuth();
  const [content, setContent] = useState<PortfolioPageContent>(FALLBACK_PORTFOLIO_CONTENT);
  const [usingFallback, setUsingFallback] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSection, setEditorSection] = useState<PortfolioEditSection>("profile");
  // HMR may retain state created before a newly editable content branch existed.
  const safeContent = resolvePortfolioContent(content);

  // Light-mode body for this page — force-remove `dark` class while mounted so
  // next-themes (system default) can't repaint the retro layout in dark tokens.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => { if (hadDark) root.classList.add("dark"); };
  }, []);

  useEffect(() => {
    let active = true;
    loadPortfolioContent()
      .then((cloudContent) => {
        if (!active || !cloudContent) return;
        setContent(cloudContent);
        setUsingFallback(false);
      })
      .catch((error) => {
        // Public visitors keep the complete static portfolio if Firebase is unavailable or returns invalid data.
        console.warn("[portfolio] Using checked-in fallback content", error);
      });
    return () => { active = false; };
  }, []);

  function openEditor(section: PortfolioEditSection) {
    setEditorSection(section);
    setEditorOpen(true);
  }

  async function handleSave(nextContent: PortfolioPageContent) {
    const savedContent = await savePortfolioContent(nextContent);
    setContent(savedContent);
    setUsingFallback(false);
  }

  return (
    <div id="top" className="retro min-h-screen">
      <TopNav
        profileName={safeContent.profile.name}
        signedIn={Boolean(user)}
        authLoading={authLoading}
        onEdit={() => openEditor("profile")}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      {authError ? (
        <div role="alert" className="mx-auto max-w-[1100px] px-3 pt-3 text-[11px] text-red-700">{authError}</div>
      ) : null}
      <main className="mx-auto grid max-w-[1100px] gap-3 px-3 py-3 lg:grid-cols-[220px_1fr_260px]">
        <LeftSidebar content={safeContent} onEdit={user ? openEditor : undefined} />
        <CenterColumn content={safeContent} onEdit={user ? openEditor : undefined} />
        <RightSidebar content={safeContent} onEdit={user ? openEditor : undefined} />
      </main>
      <RetroFooter />
      {user ? (
        <Suspense fallback={null}>
          <PortfolioEditor
            open={editorOpen}
            content={safeContent}
            initialSection={editorSection}
            usingFallback={usingFallback}
            onOpenChange={setEditorOpen}
            onSave={handleSave}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
