# Domain separation implementation plan

Approved specification: the domain separation plan in this chat.

- [ ] Add centralized host classification and destination URL resolution, retaining /app routes and local/preview access. Test exact hosts and legacy URLs.
- [ ] Add bounded, versioned local transfer with an explicit storage allowlist, owner checks, preview, rollback and recovery. Test round trips, identity boundaries and storage failures before wiring UI.
- [ ] Wire portfolio and tracker links, migration notice, recovery and Settings import. Preserve same-origin APIs and existing headers.
- [ ] Run tests, lint, frontend/API type checks and build. Verify preview before promotion, Firebase domain authorization and public production behavior.

Confirmed tracker production alias: job-tracker-pro-joshhyjr-s-projects.vercel.app. Keep www.jkivaria.com as the portfolio canonical origin. Automatic redirects require per-browser explicit confirmation after verification; no global cutover that strands another browser's documents.
