# Repository audit — September 5, 2026

> Release preparation update — September 6: all **320 tests now pass**, including the five Firestore emulator tests, using a temporary Java 21 runtime and an isolated demo project. TypeScript, lint, and the production build pass. CI actions are pinned to verified commit SHAs, setup-node is updated to v7, and workflow permissions are scoped per job. GitHub dependency graph/alerts are enabled and its dependency-review API responds successfully. Live Vercel inspection found no custom firewall rules; the shared rate-limit follow-up remains open. The npm audit still awaits explicit approval for its metadata transfer. The September 5 findings and validation snapshot below are retained as historical evidence.

Six confirmed correctness bugs and one export hardening gap were fixed locally. The audit covered application persistence, import/export, metrics, forms, document attachment writes, API access controls, browser security boundaries, Firestore rules, and CI configuration. All pre-existing edits were preserved. No commit, push, deployment, production data mutation, or external message was performed.

## Fixed findings

| ID | Priority / impact | Bug | Fix and evidence | Next step |
| --- | --- | --- | --- | --- |
| B1 | High — data integrity | Custom export columns could overwrite canonical Application ID, Company Name, or status fields. Re-importing could then target the wrong record or lose history linkage. | [Export row builder](/Users/josh/job-tracker-pro/src/lib/export.ts:80) allocates collision-free custom aliases across the entire workbook. Unit coverage includes an already-prefixed custom header. Actual browser CSV and XLSX downloads retained canonical IDs/company names, custom values, and XLSX activity-history linkage. | Include the fix in the next reviewed release; inspect older exports before using them as recovery files. |
| B2 | High — data integrity | Duplicate replacement IDs could collapse multiple input rows into one Firestore document while stale rows were deleted. Invalid IDs could fail after earlier chunks had already committed. | [ID validation](/Users/josh/job-tracker-pro/src/lib/security.ts:52) rejects duplicates, invalid path segments, reserved IDs, and IDs changed by serialization before replacement reads/writes. Cloud/demo batch writers share validation; the import coordinator validates replacements before backup side effects. | Correct any rejected workbook IDs and retry. Existing stored records are not rewritten. |
| B3 | Medium — lost attachment data | Concurrent resume and cover-letter links used the same stale full application snapshot, allowing one write to erase the other link and history entry. | [Attachment queue](/Users/josh/job-tracker-pro/src/pages/Documents.tsx:164) serializes writes per application and reads the latest saved record before the next write. Regression tests cover first-save success and failure. | Release the fix. Cross-device full-record edit conflicts remain outside this local queue's guarantee. |
| B4 | Medium — misleading save state | The first completed concurrent mutation set syncing to false while another save remained pending. | [Shared mutation status hook](/Users/josh/job-tracker-pro/src/hooks/useMutationStatus.ts:3) tracks pending operations. Owner success/failure overlap and demo reset/edit overlap are tested. | Release the fix; this changes status bookkeeping, not cloud write ordering. |
| B5 | Medium — incorrect application dates | New application forms derived a calendar date from UTC, defaulting to tomorrow during Halifax evenings. | [Local date default](/Users/josh/job-tracker-pro/src/pages/ApplicationForm.tsx:89) uses local calendar formatting. Browser clock fixed at September 5, 22:30 Halifax / September 6, 01:30 UTC showed and saved September 5. | Release the fix; review existing future-dated records if their dates were accepted from the old default. |
| B6 | Medium — misleading metrics | Imports with only Current Status were classified using the parser's Applied response default, undercounting rejections and active processes while inflating awaiting/stale counts. | [Metric status fallback](/Users/josh/job-tracker-pro/src/lib/jobSearchMetrics.ts:95) uses Current Status when Response Status is blank/default Applied, preserving explicit response/custom stages. | Release the fix; metrics recompute without rewriting stored records. |
| S1 | Low — defense in depth | Spreadsheet formula neutralization omitted a leading line-feed character. | [Export prefix guard](/Users/josh/job-tracker-pro/src/lib/export.ts:4) now handles line feeds alongside existing formula/control prefixes. Regression added. This closes a guard gap; arbitrary code execution was not demonstrated. | Retain formula-neutralization coverage. Spreadsheet handling varies by consumer; see [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection). |

## Remaining security risks

No critical vulnerability was confirmed in the inspected first-party code. This is a bounded source review, not a penetration test or a clean dependency bill of health.

| ID | Severity / status | Evidence and risk | Next step |
| --- | --- | --- | --- |
| S2 | Medium — unresolved operational risk | [API limiter state](/Users/josh/job-tracker-pro/api/_shared/security.ts:8) is an in-memory Map. Counts are local to a function instance and reset when it restarts; multiple instances do not share a quota. The public contact route may therefore accept more requests than its nominal limit. Hosted AI additionally requires an approved owner token. Live edge/firewall controls were not inspected. | Verify deployed edge rate limits for `/api/contact` and `/api/ai-insights`, or use a shared durable limiter. Origin checking is a browser control, not bot authentication. |
| S3 | Low — supply-chain hardening | [CI](/Users/josh/job-tracker-pro/.github/workflows/ci.yml:22) and [security workflows](/Users/josh/job-tracker-pro/.github/workflows/security.yml:28) reference mutable action version tags. | Resolve and pin trusted action revisions to full commit SHAs, keeping version comments and dependency updates. This follows [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use). No evidence of a compromised action was found. |
| S4 | Unknown — dependency audit blocked | The initial npm audit could not resolve the registry. Automatic approval review rejected the network-enabled retry because dependency metadata would be sent to an external npm registry without explicit payload authorization. No vulnerability count was obtained and no dependency upgrades were guessed. | Obtain approval to send dependency names/versions to npm and run `npm audit --json`; evaluate any returned advisories before making scoped upgrades. |
| S5 | Unverified — live security-rule enforcement | Source rules restrict private application/backups to the verified approved owner and deny unmatched paths. The five rules tests were skipped because no Firestore emulator is running; the machine has no usable Java runtime. Deployed rules were not inspected. | Install a supported Java runtime, run `npm run test:rules`, and verify deployed rules before release. |

Existing controls reviewed include approved-owner AI token verification, request body size limits, exact JSON content-type checks, contact HTML escaping, sanitized provider logging, HTTP(S)-only external application URLs, inert document-preview MIME allowlisting, CSP, and owner/demo storage separation. The corresponding existing automated tests passed. A limited tracked-file secret-pattern scan found only documented private-key placeholders in README/deployment instructions; it did not inspect Git history or replace a full Gitleaks scan.

## Verification and release status

| Check | Result |
| --- | --- |
| Baseline tests | 298 passed; 5 emulator-dependent tests skipped. |
| Final full suite | 315 passed; 5 emulator-dependent tests skipped. |
| Regression evidence | New tests reproduced pre-fix failures for the six correctness findings; attachment tests were also checked against the original source with valid fixtures. |
| TypeScript | Browser, build configuration, and API checks passed. |
| ESLint | Passed with 0 errors and 7 existing Fast Refresh warnings in unchanged UI component files. |
| Production build | Passed; existing large-chunk warnings remain. |
| Browser verification | Isolated synthetic demo: local date rollover, form save/list navigation, CSV/XLSX export downloads, canonical field preservation, and XLSX activity-history linkage passed. |
| Browser limitations | Local Cloudflare telemetry CORS failures and synthetic-company favicon 404s were observed. No owner authentication, production API call, or live Firestore mutation was tested. |
| Diff hygiene | `git diff --check` passed. SHA-256 checks confirmed all five pre-existing modified files were unchanged by this audit. |
| Publication | Changes are local and uncommitted; nothing was pushed or deployed. |

The next release should first resolve the dependency-audit and Firestore-rule verification gaps, review the scoped diff, then commit and publish through the normal approved release process. The existing Analytics/Follow-ups edits are separate from this audit's changes.
