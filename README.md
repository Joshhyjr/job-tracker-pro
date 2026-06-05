# Job Tracker Pro

[![CI](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/ci.yml)
[![Security](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/security.yml/badge.svg)](https://github.com/Joshhyjr/job-tracker-pro/actions/workflows/security.yml)

A modern job application tracking platform designed to help users organise applications, monitor progress, and gain intelligent insights into their job search.

Production: [job-tracker-pro-nine.vercel.app](https://job-tracker-pro-nine.vercel.app)

## Features

- Dashboard analytics for application progress, outcomes, and follow-up activity
- Recent Applications section for quick access to the latest opportunities
- Insights & Recommendations based on current job search activity
- Local Ollama AI insights for privacy-first job-search coaching
- Application status tracking across applied, interview, offer, rejection, and withdrawn stages
- Follow-up management with dates and overdue visibility
- XLSX import/export powered by ExcelJS
- Responsive design for desktop and mobile workflows
- Dark mode UI with polished Job Tracker Pro branding
- Security hardening through headers, dependency checks, and safer data handling
- Future AI-powered career insights foundation

## Recent Improvements

- Added Recent Applications to the dashboard
- Added Insights & Recommendations
- Added local-only Ollama AI insight generation
- Added Job Tracker Pro branding and logo
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

Job Tracker Pro includes practical security controls for a frontend portfolio app:

- Secret protection with `.env` ignore rules and a safe `.env.example`
- Dependabot updates for npm packages and GitHub Actions
- CodeQL scanning for JavaScript and TypeScript security issues
- Gitleaks secret scanning before deployment
- Sanitisation for manual and imported job application data
- Vercel security headers, including CSP, referrer policy, permissions policy, and `nosniff`

Private API keys, including future AI provider keys, must stay server-side only and must not use `VITE_` environment variables.

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

## Local AI Insights

AI insights are generated manually through local Ollama, so job-search summaries stay on your machine and no hosted API key is required.

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
