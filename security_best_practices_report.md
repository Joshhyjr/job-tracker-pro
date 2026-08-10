# Weekly Security Audit — 2026-08-10

## Executive summary

The live audit initially found **8 vulnerable dependency entries (6 high, 2 moderate), no critical advisories, and no high-confidence committed secrets**. All dependency advisories and verified application findings below are resolved in this branch; final full and production-only npm audits report **0 vulnerabilities**. Server-only credentials remain outside the Vite bundle, Firestore rules still restrict data to the verified owner, and CI already runs npm audit, dependency review, CodeQL, Gitleaks, and reproducible installs.

Breaking maintenance upgrades unrelated to an advisory are intentionally deferred for compatibility testing.

## Findings and fixes

### SEC-2026-08-10-01 — Vulnerable dependency graph

- **Severity:** High
- **Status:** Resolved in this run
- **Location:** `package.json` (`postcss`, `react-router-dom`, `vite`) and `package-lock.json`
- **Evidence:** `npm audit --json` reported vulnerable `brace-expansion`, `fast-xml-parser`, `js-yaml`, `nanoid`, `postcss`, `react-router`, `react-router-dom`, and `undici`. The browser-relevant Router advisory includes [GHSA-jjmj-jmhj-qwj2](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2); the direct PostCSS advisory includes [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849).
- **Impact:** The graph includes denial-of-service, information-disclosure, path-traversal, response-parsing, and open-redirect/XSS advisories.
- **Fix:** Refreshed compatible transitive versions, set explicit safe floors for PostCSS and Vite, upgraded React Router DOM to 7.18.2, and removed the stale unsupported `bun.lock` so npm's audited lockfile is the single documented/CI source of truth.
- **Mitigation:** Weekly npm audit, Dependabot, dependency review, and the lockfile remain enabled.
- **False-positive notes:** Some vulnerable parser paths are not fed attacker input in this app, and the Router SSR advisory is not used by this SPA; the browser open-redirect advisory still applies.

### SEC-2026-08-10-02 — API limits occur after unbounded Node request buffering

- **Severity:** Medium
- **Status:** Resolved in this run
- **Location:** `api/contact.ts` (`toWebRequest`) and `api/ai-insights.ts` (`toWebRequest`)
- **Evidence:** Both adapters collect every incoming chunk before the 8 KB or 16 KB core-handler checks run.
- **Impact:** Oversized, unauthenticated, or unsupported requests can consume function memory before rejection.
- **Fix:** Added one shared Node adapter that rejects oversized declared and chunked bodies while streaming and maps the typed failure to a no-store JSON `413` response.
- **Mitigation:** Keep the existing core-handler byte checks as defense in depth.
- **False-positive notes:** Vercel may impose a larger platform limit, but that does not enforce these application-specific caps before buffering.

### SEC-2026-08-10-03 — AI authentication work is not pre-throttled

- **Severity:** Medium
- **Status:** Resolved in this run
- **Location:** `api/ai-insights.ts` (`handleAiInsightsRequest`)
- **Evidence:** Firebase token verification runs before the existing authenticated-owner rate limiter.
- **Impact:** Invalid-token traffic can repeatedly consume Firebase verification and function compute without reaching the 12-per-minute owner bucket.
- **Fix:** Added a separate 60-per-minute pre-authentication IP bucket while preserving the existing 12-per-minute authenticated-owner limit.
- **Mitigation:** The documented Vercel Firewall rules remain the distributed enforcement layer.
- **False-positive notes:** In-memory buckets are per function instance and cannot replace the firewall.

### SEC-2026-08-10-04 — Hosted AI receives unnecessary workbook metadata

- **Severity:** Medium
- **Status:** Resolved in this run
- **Location:** `src/lib/aiInsights.ts` (`generateHostedAiInsights`) and `api/ai-insights.ts` (`parseSummary` / `buildGeminiRequest`)
- **Evidence:** Exact workbook filenames, import timestamps, and custom-field header names are included in the summary forwarded to Gemini.
- **Impact:** Filenames and headers can reveal client, immigration, salary, or other sensitive context that is not needed for recommendations.
- **Fix:** Introduced a hosted-provider DTO that keeps only source type, row/warning counts, and numeric coverage; the server rebuilds the same allowlist before contacting Gemini.
- **Mitigation:** Keep local metadata available to the UI and local Ollama flow without forwarding it to the hosted provider.
- **False-positive notes:** Company, role, and location summaries remain intentionally included for tailored guidance; hosted summaries are minimized, not anonymous.

### SEC-2026-08-10-05 — Imported job links permit active URL schemes

- **Severity:** Medium
- **Status:** Resolved in this run
- **Location:** `src/lib/security.ts` (`sanitizeApplicationInput`) and `src/pages/ApplicationsList.tsx` (drawer job link)
- **Evidence:** `jobLink` is stored as text and rendered directly as an anchor; React 18 preserves a `javascript:` href. The detail page separately validates HTTP(S), so protection is inconsistent.
- **Impact:** A clicked imported link can attempt script execution or unsafe navigation wherever the Vercel CSP is absent or weakened.
- **Fix:** Centralized an absolute HTTP(S)-only URL sanitizer and applied it to create, import, local/demo update persistence, and every clickable job-link sink.
- **Mitigation:** Production CSP remains defense in depth, not the primary validator.
- **False-positive notes:** Exploitation requires a malicious/tampered record and a user click.

### SEC-2026-08-10-06 — Low-risk hardening regressions

- **Severity:** Low
- **Status:** Resolved in this run
- **Location:** `src/components/ui/chart.tsx`, `src/lib/storage.ts`, `src/pages/Documents.tsx`, `.github/workflows/*.yml`, and `vercel.json`
- **Evidence:** Chart identifiers/config keys enter generated CSS; IDs use `Math.random()` plus time; arbitrary `data:` MIME types receive a Preview action; CI uses Node 20 while `package.json` requires Node 22; CSP lacks `form-action`.
- **Impact:** These gaps increase future CSS injection, collision/predictability, legacy active-content preview, runtime drift, and form-exfiltration risk.
- **Fix:** Sanitized CSS identifiers/colors, adopted Web Crypto IDs, preserved every document while previewing only inert MIME types, aligned CI to Node 22, and added `form-action 'self'` with regression tests.
- **Mitigation:** The chart helper currently has no untrusted call site, document previews already use `noreferrer`, and `frame-ancestors 'none'` already blocks framing.
- **False-positive notes:** The document preview issue is defense in depth rather than a demonstrated same-origin XSS in modern browsers.

### SEC-2026-08-10-07 — API parsing and logging hardening

- **Severity:** Low
- **Status:** Resolved in this run
- **Location:** `api/contact.ts` and `api/ai-insights.ts`
- **Evidence:** `startsWith("application/json")` accepts lookalike media types, and raw provider error bodies are copied into retained logs.
- **Impact:** Malformed content types bypass the intended gate, while provider diagnostics could echo contact or request data into logs.
- **Fix:** Parse the MIME type exactly, log only status plus an allowlisted provider request identifier, and cancel unused provider bodies without decoding or retaining them.
- **Mitigation:** JSON parsing, schema checks, fixed provider destinations, and sanitized client errors are already present.
- **False-positive notes:** No current provider response was shown to contain a secret; the change removes reliance on that external behavior.

## Confirmed-safe controls

- Only `.env.example` is tracked; real `.env` files and Firebase Admin downloads are ignored.
- Gemini, Resend, and Firebase Admin credentials use server-only `process.env`; browser `VITE_*` values are limited to public Firebase configuration and the local Ollama model name.
- Firestore denies unmatched paths and requires the verified allowlisted owner for application and recovery data.
- API routes enforce exact browser origin, validated JSON shapes, fixed provider destinations, escaped email HTML, no-store responses, and endpoint rate limits.
- npm is the only documented and CI package manager; `package-lock.json` is tracked with integrity hashes and clean `npm ci` reproduction.
- No application `eval`, unsafe `postMessage`, service worker, public source maps, or unprotected new-tab links were found.

## Accepted residual risks

- Complete document files remain JavaScript-readable in origin-scoped local storage. Replacing this with encrypted or authenticated file storage is an architectural product change; this run preserves existing documents and tightens preview behavior without migrating or deleting data.
- Cloudflare Web Analytics is a third-party script on the shared portfolio/app origin and therefore has first-party script privilege. Removing analytics or separating the public portfolio and private app origins is a product/deployment decision; no current compromise was found.
- `npm outdated` still reports non-security maintenance drift, including compatible Radix UI, Firebase 12, React Hook Form, TypeScript ESLint, Vitest, font, and Autoprefixer updates. Major upgrades such as React 19, Vite 8, Tailwind 4, Recharts 3, Zod 4, and Firebase Admin 14 are also available. These are deferred to dedicated compatibility work rather than mixed into an advisory patch.

## Verification results

- Node 22 clean install: `npm ci` passed and reproduced the npm lockfile with 0 vulnerabilities.
- Dependency audits: full and production-only `npm audit` both passed with 0 total advisories.
- TypeScript: app, API, Node, and root project checks passed.
- Tests: 32 files / 209 tests passed; the 3 Firestore emulator tests remain skipped by the normal suite because rules were unchanged and no emulator was started.
- ESLint: 0 errors and the same 7 pre-existing Fast Refresh warnings as the baseline.
- Production build and JSON/YAML configuration parsing passed. Vite retains its existing large-chunk advisory.
- `git diff --check` and an independent integrated security/regression review passed after its three findings were corrected.
