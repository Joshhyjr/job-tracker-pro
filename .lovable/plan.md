## Goal

Rebuild the site as a personal portfolio for Joshua Kivaria with a Midnight Indigo dark theme, glassmorphism, and an animated illustrated avatar. Keep the existing Job Tracker Pro app fully working under `/app/*` and feature it as a project on the portfolio.

## Routing changes

- `/` → new `Portfolio` page (single-page scroll: Hero, About, Skills, Projects, Experience, Resume, Contact, Footer)
- `/app` → existing `Dashboard`
- `/app/applications`, `/app/applications/:id`, `/app/follow-ups`, `/app/locations`, `/app/add` → existing pages
- `AppNavbar` only renders when route starts with `/app`; portfolio uses its own `PortfolioNav`
- Update internal navigation links inside the app pages (navbar, redirects) from `/applications` → `/app/applications`, etc.

## Theme

Update `src/index.css` `.dark` tokens to Midnight Indigo:
- `--background: 240 50% 6%` (#0a0a1a)
- `--card: 234 45% 14%` (#141432)
- `--primary: 239 84% 60%` (#4f46e5)
- `--accent: 240 52% 24%` (#1e1e5a)
- Glass tokens tuned for indigo
- Add gradient + glow utility classes (`bg-hero-gradient`, `shadow-glow`)

Force dark theme as default for portfolio. Keep liquid-glass aesthetic.

Install fonts via `@fontsource/space-grotesk` + `@fontsource/inter`, wire in `main.tsx` + `tailwind.config.ts`.

## New files

- `src/pages/Portfolio.tsx` — sections composed inline
- `src/components/portfolio/Hero.tsx`
- `src/components/portfolio/AnimatedAvatar.tsx` — floating + waving wrapper + typing speech bubble
- `src/components/portfolio/About.tsx`
- `src/components/portfolio/Skills.tsx` — 4 grouped glass cards with lucide icons
- `src/components/portfolio/Projects.tsx` — Job Tracker Pro (links to `/app`), Grocery Deals Finder, Spam Detection Model, Inventory & Budget App
- `src/components/portfolio/Experience.tsx` — vertical timeline
- `src/components/portfolio/Resume.tsx` — placeholder download (`/resume.pdf`, file dropped in `public/` later)
- `src/components/portfolio/Contact.tsx` — name/email/message form (client-side only, mailto fallback) + social links
- `src/components/portfolio/Footer.tsx`
- `src/components/portfolio/PortfolioNav.tsx` — sticky glass nav with smooth-scroll anchors + link to `/app` ("Try Job Tracker")
- `src/components/portfolio/SectionReveal.tsx` — IntersectionObserver wrapper applying `animate-fade-in`
- `src/assets/avatar.png` — AI-generated friendly illustrated developer character (transparent background), used inside `AnimatedAvatar`

## Animations

- Tailwind keyframes added: `float`, `wave`, `blink`, `typing` (caret blink + width steps)
- `SectionReveal` uses IntersectionObserver + `animate-fade-in`
- Hover scale on cards/buttons via existing `hover-scale` utility

## Content (verbatim from request)

Hero copy, about paragraph, skill groupings, four project cards with tech badges + GitHub/View buttons (placeholder `#` links labeled clearly), experience timeline entries, contact links (LinkedIn, GitHub, email, jkivaria.com) — all written into the components.

## Out of scope

- No backend changes, no new storage, no edits to `api/`, `src/lib/`, or test files
- Job Tracker functionality untouched apart from route prefix

## Technical notes

- Smooth scroll via `scroll-behavior: smooth` on `html` + anchor IDs per section
- Contact form: local state, on submit opens `mailto:` with prefilled body (no backend per scope)
- All placeholder links/images clearly labeled with comments so Joshua can swap them
- Comments added per project rule on all new/modified code