# Job Tracker

[![CI](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/ci.yml)
[![Security](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/security.yml/badge.svg)](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/security.yml)

A modern job application tracking platform designed to help users organise applications, monitor progress, and gain intelligent insights into their job search.

Production: [www.jkivaria.com](https://www.jkivaria.com)

## Features

- Dashboard analytics for application progress, outcomes, and follow-up activity
- Recent Applications section for quick access to the latest opportunities
- Insights & Recommendations based on current job search activity
- Hosted Gemini AI insights with a privacy-first local Ollama fallback
- Application status tracking across applied, interview, offer, rejection, and withdrawn stages
- Follow-up management with dates and overdue visibility
- XLSX import/export powered by ExcelJS
- Responsive design for desktop and mobile workflows
- Dark mode UI with polished Job Tracker branding
- Security hardening through headers, dependency checks, and safer data handling
- Future AI-powered career insights foundation

## Recent Improvements

- Added Recent Applications to the dashboard
- Added Insights & Recommendations
- Added hosted Gemini AI insights with local Ollama fallback
- Added Job Tracker branding and logo
- Removed Lovable branding
- Added CI/CD workflows for linting, typechecking, tests, and builds
- Added automated security scans with npm audit, CodeQL, dependency review, and Gitleaks
- Added sanitisation and safer imports for user-entered and spreadsheet data
- Replaced the vulnerable `xlsx` package with ExcelJS

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Vercel
- ExcelJS
- GitHub Actions

## Security

Job Tracker includes practical security controls for a frontend portfolio app:

- Secret protection with `.env` ignore rules and a safe `.env.example`
- Dependabot updates for npm packages and GitHub Actions
- CodeQL scanning for JavaScript and TypeScript security issues
- Gitleaks secret scanning before deployment
- Sanitisation for manual and imported job application data
- Vercel security headers, including CSP, referrer policy, permissions policy, and `nosniff`

Private API keys, including `G_API_KEY`, must stay server-side only and must not use `VITE_` environment variables.

## Future Roadmap

- Background AI-generated career insights
- Resume analysis
- Salary expectations
- Suggested job roles
- AI productivity recommendations

## Installation

```sh
npm install
npm run dev
```

## Authentication and cloud sync

Job Tracker uses Google Authentication and Cloud Firestore to synchronize application records across trusted devices. The portfolio at `/` and an interactive synthetic-data demo at `/app/*` remain public. Signing in with the verified Google account `joshuakivaria@gmail.com` switches the same interface to the private Firestore workspace; other accounts remain in demo mode.

1. Create a Firebase project and register a Web app.
2. In **Authentication → Sign-in method**, enable Google.
3. Add local and production hostnames under **Authentication → Settings → Authorized domains**.
4. Create a standard Cloud Firestore database, then deploy the repository rules with `firebase deploy --only firestore:rules`.
5. Copy the Firebase Web app configuration into `.env.local` and the matching Vercel environment variables:

```sh
VITE_FIREBASE_API_KEY="your-public-web-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-web-app-id"
```

These `VITE_FIREBASE_*` values identify the public Firebase Web app and are safe to bundle. Authorization is enforced by `firestore.rules`; never add a Firebase Admin private key, service-account JSON, `GEMINI_API_KEY`, or another server secret to a `VITE_` variable.

The production Content Security Policy must retain the Firebase auth helper iframe and Google API origins defined in `vercel.json`. Removing those origins prevents `signInWithPopup` from initializing and Firebase may report the blocked request as `auth/internal-error`.

On the first successful sign-in, browser-local applications are merged into the account once. Existing cloud records win ID conflicts, and the browser copy is retained as a recovery backup. Subsequent edits use Firestore realtime listeners and persistent browser caching. Concurrent edits use document-level last-write-wins behavior; v1 does not merge individual fields.

For this single-user project, configure Firebase budget alerts even when expected usage is within the free quota.

Install the Firebase CLI and run the rule suite against the local emulator before deploying rule changes:

```sh
npm install --global firebase-tools
npm run test:rules
```

## AI Insights

AI insights use Google Gemini through the server-side `/api/ai-insights` Vercel Function. Only the dashboard's summarized application metrics are sent; notes, links, recruiter names, custom fields, and complete application records remain in the browser.

Add these server-side environment variables locally and in Vercel:

```sh
GEMINI_API_KEY="your-google-ai-studio-key"
GEMINI_MODEL="gemini-3.5-flash"
FIREBASE_ADMIN_PROJECT_ID="your-project-id"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-...@your-project.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Create the Admin credentials from **Firebase Console → Project settings → Service accounts**, then copy only the required fields into private environment variables. Never commit the downloaded service-account JSON. The signed-in browser sends its short-lived Firebase ID token, and the Vercel function verifies that token and the approved email before calling Gemini; no shared access token is entered in the UI. `GEMINI_MODEL` selects the primary model. Capacity failures automatically retry with `gemini-3.1-flash-lite` before using Ollama. Gemini's free tier has usage limits, and Google may use free-tier requests to improve its products. Never prefix the Gemini or Admin secrets with `VITE_`, because Vite exposes those variables to browser code.

Use `vercel dev` to run the frontend and Gemini function together locally. Plain `npm run dev` runs only Vite, so hosted requests will fall back to Ollama.

### Ollama Fallback

When Gemini is unavailable or not configured, AI insights fall back to local Ollama so summaries can stay on your machine.

```sh
ollama pull qwen2.5:7b
ollama serve
```

If Ollama blocks browser requests, start it with an origin that allows the app:

```sh
OLLAMA_ORIGINS=http://localhost:8080 ollama serve
```

## Build

```sh
npm run build
```

## Quality Checks

```sh
npm run lint
npm test
```
