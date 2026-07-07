# Joshua Kivaria — Cockpit Portfolio Plan

A minimal, premium "luxury performance cockpit" redesign of the existing portfolio at `/`. The Job Tracker app stays untouched under `/app/*`. No code will be written until you approve this plan.

---

## 1. Overall concept

The site reads as a **calm digital cockpit**, not a racing game. The car-dashboard motif is expressed through **layout language and small details**, not literal skeuomorphism:

- Dashboard-style **status bar** at the top (time, location, "systems nominal" indicator).
- **One** hero speedometer — a single, restrained gauge that animates once.
- **Panel-based sections** with thin dividers, like instrument clusters on a luxury EV (think Polestar / Porsche Taycan UI, not arcade racer).
- **Traffic-light accents** (red / amber / green) used sparingly as status dots, never as decoration.
- **Carbon-fiber texture** appears only as a faint background grain at ~3% opacity.
- Typography and whitespace do most of the work. Recruiters should feel "premium product page," not "video game."

Guardrails: max one gauge on screen at a time, no animated needles bouncing on hover, no neon glows, no chrome bezels, no checkered flags, no engine sounds.

---

## 2. Site structure

Single-page scroll at `/` with anchor nav. Job Tracker remains at `/app`.

| Section            | Anchor            | Cockpit label              |
| ------------------ | ----------------- | -------------------------- |
| Home               | `#cockpit`        | Cockpit                    |
| About              | `#driver`         | Driver Profile             |
| Skills             | `#performance`    | Performance Specs          |
| Projects           | `#garage`         | The Garage                 |
| Experience         | `#journey`        | Journey Log                |
| Certifications     | `#licenses`       | Licenses & Upgrades        |
| Resume             | `#spec-sheet`     | Spec Sheet                 |
| Contact            | `#ignition`       | Start the Engine           |
| Try Job Tracker    | → `/app`          | "Launch Job Tracker" CTA   |

Nav shows real labels with cockpit labels as small subtitles (e.g. "Projects · The Garage") so recruiters skimming aren't confused.

---

## 3. Content strategy

### 3.1 Cockpit (Hero)
- **Purpose:** Instant identity + tagline + single gauge moment.
- **Heading:** "Joshua Kivaria"
- **Sub:** "Data Analyst by title. Problem-solver by nature. Builder by habit — Halifax, NS"
- **Tagline:** *"I’ve got 99 problems, but messy data won’t be one."*
- **Visual:** one minimalist speedometer (0–100) reading "Availability: Open to work."
- **CTAs:** `View The Garage` (primary) · `Download Spec Sheet` (outline) · `Start the Engine` (ghost).
- **Restraint:** no avatar animation, no typing bubble, no secondary widgets.

### 3.2 Driver Profile (About)
- **Purpose:** Short human intro.
- **Heading:** "Driver Profile"
- **Copy:** 2 short paragraphs — what he does, how he thinks (data + support + shipping).
- **Side panel:** 4 compact stat cards — *Based in*, *Focus*, *Currently*, *Open to*.
- **CTA:** `Read the Journey Log →`

### 3.3 Performance Specs (Skills)
- **Purpose:** Show capability without ego.
- **Heading:** "Performance Specs"
- **Layout:** 3 grouped panels (Data, Support & Systems, Development). Inside each: 4–6 skills with **thin horizontal performance bars** (no percentages on the screen — labels like "Advanced / Proficient / Working").
- **No gauges here** — gauge stays in hero only.
- **CTA:** none; this section is informational.

### 3.4 The Garage (Projects)
- **Purpose:** Featured work.
- **Heading:** "The Garage"
- **Layout:** 2-column grid of "spec sheet" cards. Each card:
  - Model name (project title)
  - One-line tagline
  - Spec rows: *Stack*, *Role*, *Status* (green/amber dot)
  - Two buttons: `Open` · `Source`
- **Featured:** Job Tracker Pro card has a `Launch` button → `/app`.
- **CTA at bottom:** `See more on GitHub →`

### 3.5 Journey Log (Experience)
- **Purpose:** Career timeline.
- **Heading:** "Journey Log"
- **Layout:** vertical timeline, left-aligned on mobile, centered on desktop. Each entry: role, company, dates, 2–3 bullets, optional "milestone" chip.

### 3.6 Licenses & Upgrades (Certifications)
- **Purpose:** Verified credentials.
- **Heading:** "Licenses & Upgrades"
- **Layout:** compact card grid, each card: issuer logo slot, cert name, issued date, `Verify` link.

### 3.7 Spec Sheet (Resume)
- **Purpose:** Single resume download.
- **Heading:** "Spec Sheet"
- **Copy:** one sentence ("Full PDF version of my profile.")
- **CTA:** `Download Spec Sheet (PDF)`.

### 3.8 Start the Engine (Contact)
- **Purpose:** Lightweight contact.
- **Heading:** "Start the Engine"
- **Copy:** "Ready to talk? Send a message or reach out directly."
- **Form:** name, email, message — submits via `mailto:` fallback (no backend in scope).
- **Side links:** LinkedIn, GitHub, email, jkivaria.com.

Each section is capped at one screen height on desktop where feasible to keep the "panel" feel.

---

## 4. UI layout

**Desktop (≥1024px):**
- Sticky top **status bar** (60px): brand mark · nav · live clock (Halifax) · status dot.
- Hero: 2-column — left text + CTAs, right single speedometer.
- Other sections: centered max-width 1100px, generous 120px vertical padding between sections.
- Thin 1px dividers using `border-border/40` between major sections — instrument-cluster feel.

**Tablet (768–1023px):**
- Nav collapses to icon + sheet menu.
- Hero stacks: text first, gauge below.
- Skills panels go 2 columns; Garage 2 columns.

**Mobile (<768px):**
- Status bar shrinks: brand + menu button only.
- All sections single column.
- Gauge scales to 240px max.
- Bottom-fixed "Start the Engine" CTA bar is **not** added — keeps it minimal.

---

## 5. Components

New `src/components/cockpit/` directory:

- `CockpitNav.tsx` — sticky status bar + nav.
- `StatusBar.tsx` — small sub-component: clock, location, green status dot.
- `Speedometer.tsx` — single SVG gauge, animates needle 0 → target once on mount, respects `prefers-reduced-motion`.
- `Hero.tsx` — composes headline + Speedometer.
- `DriverProfile.tsx` — about + stat cards.
- `StatCard.tsx` — compact key/value card.
- `PerformancePanel.tsx` — grouped skills wrapper.
- `PerformanceBar.tsx` — labeled thin progress bar (uses existing `Progress` primitive).
- `GarageCard.tsx` — project spec-sheet card.
- `Garage.tsx` — grid wrapper.
- `JourneyTimeline.tsx` + `JourneyEntry.tsx`.
- `LicenseCard.tsx` + `Licenses.tsx`.
- `SpecSheet.tsx` — resume download panel.
- `Ignition.tsx` — contact form + side links.
- `CockpitFooter.tsx` — minimal footer with one status line.
- `SectionPanel.tsx` — shared wrapper enforcing spacing, heading style, and optional cockpit subtitle.
- Reuse existing `SectionReveal.tsx`.

Pages:
- Replace `src/pages/Portfolio.tsx` contents to compose the new sections.
- Delete-on-implement (only after approval): `Hero.tsx`, `About.tsx`, `Skills.tsx`, `Projects.tsx`, `Experience.tsx`, `Resume.tsx`, `Contact.tsx`, `Footer.tsx`, `PortfolioNav.tsx`, `AnimatedAvatar.tsx`, `AutoCarousel.tsx`, `Certifications.tsx` under `src/components/portfolio/`. `SectionReveal.tsx` moves to `cockpit/` or shared.

---

## 6. Animations (subtle only)

- **Speedometer:** needle eases from 0 to target over 1.4s with `cubic-bezier(.22,.61,.36,1)`. Runs once. Disabled under `prefers-reduced-motion`.
- **Performance bars:** width animates from 0 → target over 800ms when scrolled into view. Once.
- **Garage cards:** on hover, 1px border brightens + shadow softens up. No scale, no glow ring.
- **Section reveals:** existing fade + 6px translate-up via `SectionReveal`.
- **Smooth scroll:** keep existing `html { scroll-behavior: smooth }`.
- **Status dot:** gentle 2s pulse (single dot, top bar only).

Explicitly **not** doing: parallax, marquee tickers, mouse-tracking lights, animated gradients, looping needle jitter, sound, scroll-jacking.

---

## 7. Design system

Add cockpit tokens to `src/index.css` (.dark only — portfolio forces dark):

- **Background:** `--background: 220 18% 6%` (near-black, slightly cool).
- **Surface / panel:** `--card: 220 16% 9%`.
- **Border:** `--border: 220 12% 18%` at 40–60% opacity for hairlines.
- **Foreground:** `--foreground: 220 12% 92%`; muted `220 8% 62%`.
- **Primary accent:** `--primary: 14 88% 55%` (controlled performance red, used sparingly — gauge tick, primary button only).
- **Status:** `--status-green: 142 60% 45%`, `--status-amber: 38 92% 55%`, `--status-red: 0 72% 55%`.
- **Carbon texture:** CSS background layer `repeating-linear-gradient` at 3% opacity on `body`.
- **Typography:** keep `Space Grotesk` for display; switch body to `Inter` tabular for cockpit numerals. Add a `font-mono` (JetBrains Mono) **only** for stat values and timestamps.
- **Spacing:** 8px base; section padding `py-24 md:py-32`.
- **Radius:** `--radius: 0.5rem` (tighter than current `0.75rem` for instrument feel). Cards `rounded-xl`, buttons `rounded-md`.
- **Shadows:** single soft shadow token `0 1px 0 hsl(var(--border)/.6) inset, 0 30px 60px -40px hsl(0 0% 0% / .8)`. No colored glows.
- **Icons:** `lucide-react` only, stroke 1.5, size 16–18 in UI / 20–24 in headers.
- **Buttons:** primary = solid red on near-black; outline = 1px border + transparent; ghost for tertiary. Max 1 primary button per section.
- **Cards:** glass-subtle background, 1px border, no gradient fills.
- **Clutter rules:** max 4 stat items per row, max 1 gauge per page, max 1 accent color per panel, no decorative emojis, no badge stacks >3.

---

## 8. Implementation roadmap

- **Phase 1 — Foundations:** add cockpit tokens to `index.css`, add JetBrains Mono via `@fontsource`, add carbon texture utility, scaffold `src/components/cockpit/`, swap `PortfolioNav` for `CockpitNav` + `StatusBar`.
- **Phase 2 — Hero cockpit:** build `Speedometer.tsx` (SVG, reduced-motion aware) and new `Hero.tsx` with tagline + CTAs.
- **Phase 3 — Driver + Performance:** `DriverProfile`, `StatCard`, `PerformancePanel`, `PerformanceBar`.
- **Phase 4 — Garage:** `GarageCard`, `Garage` grid, wire Job Tracker `Launch` → `/app`.
- **Phase 5 — Journey + Licenses:** `JourneyTimeline`, `JourneyEntry`, `LicenseCard`, `Licenses`.
- **Phase 6 — Spec Sheet + Ignition:** `SpecSheet` (resume), `Ignition` (form + links), `CockpitFooter`.
- **Phase 7 — Responsive polish:** mobile nav sheet, gauge scaling, spacing audit, reduced-motion pass, dark-only enforcement.
- **Phase 8 — Verify:** Playwright screenshot at 1280×1800 and 390×844, confirm no console errors, run existing vitest suite, then publish.

Out of scope: backend changes, `api/`, `src/lib/`, tests, Job Tracker pages.

---

## 9. Questions before implementation

Please confirm or provide:

1. **Resume PDF** — keep current `/public/resume.pdf` or upload a new one?
2. **Speedometer reading** — should the gauge show "Availability" (0–100, set to ~85), "Years of experience," or a custom metric?
3. **Project list for The Garage** — keep the existing four (Job Tracker, Grocery Deals, Spam Detection, Inventory & Budget) or add/remove any? Real GitHub + live URLs for each?
4. **Experience entries** — confirm roles, companies, dates, and 2–3 bullet wins per role.
5. **Certifications** — exact names, issuers, dates, and verify URLs (Coursera, Google, IBM, etc.).
6. **Profile photo** — keep the existing illustrated avatar (used elsewhere) or omit photography entirely from the cockpit hero? (Plan currently omits it to keep hero minimal.)
7. **Contact links** — confirm LinkedIn URL, GitHub URL, email address, and whether `jkivaria.com` should appear.
8. **Accent color** — okay with restrained performance red as the single accent, or prefer amber/green-leaning?
9. **Carbon texture** — okay subtle (3% opacity), or pure flat black?
10. **Clock in status bar** — show live Halifax time, or just a static "Halifax, NS · AST" label?

Reply with answers (or "use your defaults") and I'll move to build mode.
