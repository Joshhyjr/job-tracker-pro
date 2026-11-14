# Domain separation implementation plan

Approved specification: the domain separation plan in this chat.

- [x] Add centralized host classification and destination URL resolution, retaining /app routes and local/preview access. Test exact hosts and legacy URLs.
- [x] Add bounded, versioned local transfer with an explicit storage allowlist, owner checks, preview, rollback and recovery. Test round trips, identity boundaries and storage failures before wiring UI.
- [x] Wire portfolio and tracker links, migration notice, recovery and Settings import. Preserve same-origin APIs and existing headers.
- [x] Run tests, lint, frontend/API type checks and build. Verify preview before promotion, Firebase domain authorization and public production behavior.

Confirmed tracker production alias: job-tracker-pro-joshhyjr-s-projects.vercel.app. Keep www.jkivaria.com as the portfolio canonical origin. Automatic redirects require per-browser explicit confirmation after verification; no global cutover that strands another browser's documents.

Validation and production rollout evidence: `docs/RELEASE_2026-11-14_DOMAINS.md`. Private owner sign-in/sync requires the user’s account and is explicitly recorded as unverified in that release note.
