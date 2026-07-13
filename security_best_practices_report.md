# Security Best Practices Report

## Executive Summary

- Live dependency scan is clean: `npm audit --json` returned 0 vulnerabilities.
- No committed secrets were found in tracked app files; the sample env file keeps provider credentials server-side only ([`.env.example`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/.env.example:1)).
- Three medium-risk hardening issues were confirmed and remediated in this run:
  1. Missing request throttling on provider-backed API endpoints.
  2. Unsanitized CSS selector/variable interpolation in the chart style sink.
  3. Incomplete browser isolation for new-tab links and slightly underpowered response headers.

## Findings

### SEC-01

- Severity: Medium
- Rule ID: API-ABUSE-001
- Location: [`api/ai-insights.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/api/ai-insights.ts:1), [`api/contact.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/api/contact.ts:1), [`api/_shared/security.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/api/_shared/security.ts:1)
- Evidence: Both public POST handlers call paid or quota-limited providers and previously relied on origin checks alone. The shared helper now enforces per-IP windows and returns `429` with `Retry-After` ([`api/_shared/security.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/api/_shared/security.ts:36), [`api/ai-insights.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/api/ai-insights.ts:58), [`api/contact.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/api/contact.ts:56)).
- Impact: Same-origin browser traffic, automation, or compromised local sessions could repeatedly burn Gemini or Resend quota and degrade service availability.
- Fix: Added a shared `isAllowedBrowserRequest` + `enforceRateLimit` helper and applied it to `/api/ai-insights` at `12/minute` and `/api/contact` at `5/minute`.
- Mitigation: If abuse pressure rises in production, move the same limits to an edge store or platform WAF for cross-instance enforcement.

### SEC-02

- Severity: Medium
- Rule ID: REACT-XSS-001
- Location: [`src/components/ui/chart.tsx`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/src/components/ui/chart.tsx:62), [`src/lib/security.ts`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/src/lib/security.ts:44)
- Evidence: The chart helper uses `dangerouslySetInnerHTML` to generate inline CSS. This run restores sanitization for both the chart id and config-derived CSS variable suffixes before interpolation ([`src/components/ui/chart.tsx`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/src/components/ui/chart.tsx:75)).
- Impact: Malformed or attacker-influenced config keys could break selectors or produce CSS injection behavior inside the chart scope.
- Fix: Added `sanitizeCssIdentifier()` and used quoted attribute selectors plus sanitized CSS variable names.
- Mitigation: Keep chart config construction internal and review any future path that lets imported workbook labels become raw chart config keys.

### SEC-03

- Severity: Medium
- Rule ID: BROWSER-ISOLATION-001
- Location: [`src/pages/ApplicationDetail.tsx`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/src/pages/ApplicationDetail.tsx:140), [`src/pages/Portfolio.tsx`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/src/pages/Portfolio.tsx:272), [`src/components/cockpit/Ignition.tsx`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/src/components/cockpit/Ignition.tsx:110), [`vercel.json`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/vercel.json:15)
- Evidence: Several external links opened new tabs without the stronger `noopener` relationship, and the deployment header set did not yet include opener/resource isolation or `form-action` in CSP.
- Impact: New-tab pages can retain a handle to the opener in some browser scenarios, and missing defense-in-depth headers reduce protection against navigation and embedding abuse.
- Fix: Standardized `rel="noopener noreferrer"` for external new-tab links and tightened Vercel headers with `X-Frame-Options`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and a stricter CSP.
- Mitigation: If future hosting moves off Vercel, carry these headers into the new edge/server configuration.

## Dependency And Secrets Notes

- `npm audit --json`: clean on July 13, 2026.
- `npm outdated --json`: package drift remains, but it is maintenance drift rather than a live vulnerability signal. The biggest version gaps are React 18 to 19, `react-router-dom` 6 to 7, `recharts` 2 to 3, and `zod` 3 to 4 ([`package.json`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/package.json:15)).
- `vite` was already resolved to `6.4.3` in the lockfile; this run aligned the manifest range to that patched line ([`package.json`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/package.json:89), [`package-lock.json`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/package-lock.json:84)).
- The Cloudflare analytics token in [`index.html`](/Users/josh/.codex/worktrees/8295/job-tracker-pro/index.html:31) is a public site beacon token, not a secret.

## Verification

- `npm audit --json`
- `npm outdated --json`
- `npm test`
- `npm run lint`
- `npm run build`
