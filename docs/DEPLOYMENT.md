# Deployment Guide

This site is a Vite, React, TypeScript, shadcn-ui, and Tailwind CSS application. Vercel hosts the frontend and the server-side Gemini AI Insights function.

## Current Vercel Setup

- Platform: Vercel
- Deployment type: Preview deployment first
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `GEMINI_API_KEY` and `AI_INSIGHTS_ACCESS_TOKEN` required for hosted AI Insights; `GEMINI_MODEL` optionally overrides `gemini-3.5-flash`
- Routing: `vercel.json` rewrites all routes to `index.html` so React Router pages work when refreshed or opened directly

## How This Was Deployed

1. Add `GEMINI_API_KEY` and a long random `AI_INSIGHTS_ACCESS_TOKEN` to the Vercel project's Development, Preview, and Production environments. Optionally add:

   ```sh
   GEMINI_MODEL="gemini-3.5-flash"
   ```

   Keep both secrets server-side and never name either with a `VITE_` prefix. Enter the access token in the dashboard only when generating hosted insights; the browser keeps it for the current session. Gemini's free tier has usage limits, and Google may use free-tier requests to improve its products.

2. Confirm the app works locally:

   ```sh
   npm run test
   npm run build
   ```

   Use `vercel dev` when testing the Gemini function locally. `npm run dev` runs only Vite and will use the local Ollama fallback.

3. Deploy a preview build to Vercel.

   The recommended path for this project is importing the GitHub repository in the Vercel dashboard. If deploying manually with the Vercel CLI, use:

   ```sh
   vercel deploy /Users/josh/job-tracker-pro -y
   ```

4. Review the preview URL returned by Vercel.

5. Promote or redeploy to production only after the preview looks correct.

   ```sh
   vercel deploy /Users/josh/job-tracker-pro --prod -y
   ```

## Updating The Site

Use Git as the source of truth for future updates.

1. Make changes locally.
2. Run the local checks:

   ```sh
   npm run test
   npm run build
   ```

3. Commit the changes:

   ```sh
   git status
   git add <changed-files>
   git commit -m "feat: describe the site update"
   ```

4. Push to the branch connected to Vercel:

   ```sh
   git push
   ```

5. Vercel will create a new deployment from the pushed commit if the repository is connected to a Vercel project.

## Notes

- This app currently stores job tracker data in the browser with `localStorage`, so data is local to each browser and device.
- Hosted AI Insights sends only summarized application metrics to Gemini; notes, links, recruiters, custom fields, and complete application records remain in the browser.
- The Gemini endpoint requires a bearer access token in addition to same-origin and payload protections. Add distributed rate limiting and provider spend alerts for broader shared use.
- If login, synced data, or multi-device access is needed later, add a backend such as Supabase before treating the app as a shared production tool.
- Do not commit temporary workspace folders such as `tmp/`.
