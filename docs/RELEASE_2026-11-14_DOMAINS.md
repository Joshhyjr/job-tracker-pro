# Portfolio and Job Tracker domain separation — November 14, 2026

Production source: `daf5578d80dfd41a1d5e1b8cf19a70d1f247ba99` on `codex/separate-site-domains`.
Production deployment: `dpl_AnfVBDtraC3iTquithpjWHVLLQBb` (READY).
Original pre-change rollback deployment: `dpl_DqoMFtGMkneaRMjbxoG5wvQYEYGH`.

- Portfolio: https://www.jkivaria.com (jkivaria.com retains its redirect to www).
- Tracker: https://job-tracker-pro-joshhyjr-s-projects.vercel.app (root opens /app).
- Recovery: https://www.jkivaria.com/app/transfer.
- Firebase authorized domains now include the stable tracker hostname. Existing domains and database records were preserved.
- With explicit user approval, Vercel Authentication changed from `all_except_custom_domains` to `prod_deployment_urls_and_all_previews`: stable production domains are public; preview and unique deployment URLs remain protected. Temporary preview links were separately approved for verification and expire automatically.

## Verification

- 340 unit/component/API tests passed; five Firestore emulator tests skipped (no rules change).
- Frontend, API and build-configuration TypeScript checks passed.
- Production build passed; lint had zero errors and seven existing Fast Refresh warnings.
- Preview verified before production; fresh-context code review found no remaining blockers.
- Anonymous production requests returned 200 with the existing CSP on both site domains; preview and unique deployment URLs redirected to Vercel login.
- Browser checks verified production tracker root and deep links, portfolio launch and published project links, desktop/mobile/sidebar/Settings portfolio links, recovery, transfer preview and verified restore, XLSX download, and a synthetic demo XLSX merge with backup.
- Old-domain redirect confirmation and subsequent automatic navigation preserved paths, queries and fragments. Recovery remained reachable after confirmation.
- Contact endpoint rejected GET with 405; AI endpoint rejected unauthenticated POST with 401. No contact email or paid AI request was sent.

Private Google account sign-in, owner cloud sync, private document transfer, and authenticated AI generation were not exercised; these require the user's account. The transfer preserves source browser storage and downloads a recovery file; users must sign in and verify their own restored data before confirming the move in each browser. Legacy local application rows can be exported as a recovery workbook and explicitly merged through the existing importer rather than silently changing Firebase records.

Browser evidence and synthetic workbooks were moved out of the repository to `/tmp/job-tracker-domain-browser-evidence/`.
