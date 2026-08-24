# Weekly Security Audit — 2026-08-24

## Executive summary

The current full and production npm graphs contain **0 known vulnerabilities**, and registry-signature verification passed for every installed package. No high-confidence committed secret, unsafe client secret, new exploitable React sink, or API-boundary regression was found.

This run resolved five supply-chain and development-hardening gaps: GitHub Actions now use immutable commit pins, workflow token permissions are job-scoped, npm is enforced as the single lockfile path, Vite listens only on loopback by default, and CSP/header regression coverage is stronger. No Critical or High findings remain.

## Findings and fixes

### SEC-2026-08-24-01 — Mutable GitHub Action references

- **Severity:** Medium
- **Status:** Resolved
- **Location:** `.github/workflows/ci.yml:20-26`; `.github/workflows/security.yml:25-98`
- **Evidence:** Every action previously used a mutable major reference such as `actions/checkout@v7` or `github/codeql-action/*@v4`.
- **Impact:** A moved or compromised tag could replace code that CI executes with repository-token access.
- **Fix:** Resolved the current official release refs live and pinned all 12 action uses to full 40-character commit SHAs, retaining release comments for review and Dependabot updates.
- **Mitigation:** Dependabot continues to monitor the `github-actions` ecosystem weekly.
- **False-positive notes:** The actions were established first-party/security vendors; this is supply-chain defense in depth, not evidence that a tag was compromised.

### SEC-2026-08-24-02 — Security workflow grants excess token permissions

- **Severity:** Low
- **Status:** Resolved
- **Location:** `.github/workflows/security.yml:14-16`, `47-49`, and `65-67`
- **Evidence:** `security-events: write` and `pull-requests: read` were granted workflow-wide even though only CodeQL and Dependency Review need them.
- **Impact:** A compromised npm-audit or Gitleaks step would receive permissions unrelated to its job.
- **Fix:** Kept only `contents: read` globally; Dependency Review gets read-only PR access and CodeQL gets `security-events: write` at their job boundaries.
- **Mitigation:** GitHub's default token restrictions remain an additional boundary.
- **False-positive notes:** No existing workflow misuse was found; the previous grants were broader than necessary.

### SEC-2026-08-24-03 — Unsupported secondary dependency lockfile

- **Severity:** Low
- **Status:** Resolved
- **Location:** `.gitignore:10-18`; `README.md:67-74`; removed `bun.lock`
- **Evidence:** Both `package-lock.json` and a reintroduced `bun.lock` were tracked while CI, Dependabot, documentation, and live audits validate only npm.
- **Impact:** Contributors or automation could install a dependency graph that security checks do not reproduce.
- **Fix:** Removed `bun.lock`, ignored future bot-generated copies, documented npm as the single package manager, and changed installation guidance to reproducible `npm ci`.
- **Mitigation:** CI already rejects package/lock drift through `npm ci`.
- **False-positive notes:** The two lockfiles' 77 direct versions currently agreed; the risk was future unvalidated drift rather than a known vulnerable Bun resolution.

### SEC-2026-08-24-04 — Development server exposed on every interface

- **Severity:** Low
- **Status:** Resolved
- **Location:** `vite.config.ts:6-10`; `README.md:69-74`
- **Evidence:** Vite used `host: "::"`, making the development app and source-serving endpoints reachable beyond the local machine when the network allowed it.
- **Impact:** A local-network peer could inspect or interact with a developer's in-progress application.
- **Fix:** Bound Vite to `127.0.0.1` by default and documented the explicit `--host 0.0.0.0` override for intentional trusted-LAN testing.
- **Mitigation:** Vite host validation and local firewalls remain additional controls.
- **False-positive notes:** Production deployment was never affected.

### SEC-2026-08-24-05 — CSP regressions were only partially tested

- **Severity:** Low
- **Status:** Resolved
- **Location:** `src/test/vercelCsp.test.ts:4-42`
- **Evidence:** Existing tests checked required map/logo allowances and `form-action`, but would not catch a script wildcard, `unsafe-eval`, or removal of key framing/object/base restrictions.
- **Impact:** A later configuration edit could silently weaken XSS or clickjacking defense in depth.
- **Fix:** Added assertions for essential response headers, a strict script allowlist, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'`.
- **Mitigation:** The production CSP already contains these controls; this change prevents silent regression.
- **False-positive notes:** No current CSP bypass was found.

## Confirmed-safe controls

- Only `.env.example` is tracked. Real env files and Firebase Admin downloads remain ignored; current and historical high-signal scans found placeholders but no credential-shaped value.
- Gemini, Resend, and Firebase Admin credentials use server-only `process.env`. Browser `VITE_*` values are limited to public Firebase web configuration and the local Ollama model label.
- API routes retain exact same-origin checks, bounded streaming bodies, exact JSON media types, fixed provider destinations, endpoint throttling, sanitized logs, and no-store JSON responses.
- Hosted AI remains owner-token protected and rebuilds an allowlisted privacy-minimized DTO before contacting Gemini.
- Firestore Rules remain deny-by-default and require the verified allowlisted owner.
- HTTP(S)-only application URL validation, inert document-preview MIME allowlisting, sanitized chart CSS, safe new-tab relations, and Web Crypto IDs remain intact.
- No application `eval`, unsafe `postMessage`, service worker, raw untrusted HTML path, credentialed dynamic-origin request, or unprotected new-tab link was found.
- `package-lock.json` is unchanged, contains integrity hashes, and has no Git or local-file dependencies.

## Outdated packages

`npm outdated` reports maintenance drift, not a vulnerability. Dozens of compatible refreshes are available, including Firebase 12.1.0 → 12.18.0, React Query 5.101.0 → 5.102.3, React Hook Form 7.80.0 → 7.86.0, ESLint 9.39.4 → 9.39.5, Autoprefixer 10.5.0 → 10.5.4, TypeScript ESLint 8.61.1 → 8.68.0, and Vitest 3.2.6 → 3.2.7.

These non-advisory updates are deferred to a dedicated compatibility change. Major migrations—React 19, Vite 8, Vitest 4, Firebase Admin 14, Zod 4, Tailwind 4, Recharts 3, and MapLibre 6—should not be mixed into a security patch.

## Accepted residual risks and follow-ups

- **Third-party analytics:** `index.html:30-31` loads Cloudflare Web Analytics on the same origin as the private app. Vendor compromise could access origin-readable data. Removing analytics, self-hosting an approved pinned asset, or separating portfolio and tracker origins requires a product/deployment decision.
- **Device persistence:** Documents, Firebase auth, and Firestore offline cache remain on a trusted device after sign-out. A "forget this device" flow requires deliberate offline and data-loss design.
- **Distributed abuse controls:** `docs/DEPLOYMENT.md:81-92` documents Vercel Firewall limits because in-memory function buckets are per instance. Verify the published firewall rules and provider spend alerts in Vercel.
- **Firebase console controls:** The Firebase web key is correctly public; verify API restrictions and App Check settings in the Firebase/Google consoles without moving the key server-side.
- **Legacy HTTP links:** External navigation still permits plain HTTP for compatibility. Prefer HTTPS when entering new links; tightening persisted legacy data should be a reviewed migration.
- **Privacy disclosure:** The portfolio collects contact details and runs analytics while its Privacy/Terms footer links are placeholders. Publish factual policies or remove those affordances once the product wording is decided.

## Verification

- Reproducible install: `npm ci` installed 754 packages successfully. The local shell used Node 24.13.1 and correctly warned that the repository declares Node 22; workflows remain configured for Node 22.
- Dependency audits: full and production-only `npm audit` both returned 0 across every severity (814 total / 475 production dependencies).
- Provenance: all 754 installed packages have verified registry signatures; 166 also have verified attestations.
- Tests: 34 files and 232 tests passed; the unchanged Firestore emulator file and its 3 tests were skipped by the normal suite.
- TypeScript: app, API, and Node project checks passed with no diagnostics.
- ESLint: 0 errors and the same 7 existing Fast Refresh warnings.
- Build: the production Vite build passed with the existing large-chunk advisory.
- Configuration: workflow YAML parsed successfully; all 12 action refs are immutable verified SHAs; permission-scope assertions passed.
- Dev listener: Vite served HTTP 200 only on `127.0.0.1:5179`, then the temporary server was stopped.
- Integrity: `npm ls --depth=0`, JSON/config checks, `git diff --check`, and package-lock identity checks passed.
