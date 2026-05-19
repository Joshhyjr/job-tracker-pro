# Deployment Guide

This site is a Lovable-generated Vite, React, TypeScript, shadcn-ui, and Tailwind CSS application. Vercel can host it as a static frontend by running the Vite build and serving the generated `dist` directory.

## Current Vercel Setup

- Platform: Vercel
- Deployment type: Preview deployment first
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none required at the time this guide was written
- Routing: `vercel.json` rewrites all routes to `index.html` so React Router pages work when refreshed or opened directly

## How This Was Deployed

1. Confirm the app works locally:

   ```sh
   npm run test
   npm run build
   ```

2. Deploy a preview build to Vercel.

   The recommended path for this project is importing the GitHub repository in the Vercel dashboard. If deploying manually with the Vercel CLI, use:

   ```sh
   vercel deploy /Users/josh/job-tracker-pro -y
   ```

3. Review the preview URL returned by Vercel.

4. Promote or redeploy to production only after the preview looks correct.

   ```sh
   vercel deploy /Users/josh/job-tracker-pro --prod -y
   ```

## Updating The Site

Use Git as the source of truth for future updates.

1. Make changes locally or in Lovable.
2. If changes are made in Lovable, make sure they are synced or committed back to this repository.
3. Run the local checks:

   ```sh
   npm run test
   npm run build
   ```

4. Commit the changes:

   ```sh
   git status
   git add <changed-files>
   git commit -m "change: describe the site update"
   ```

5. Push to the branch connected to Vercel:

   ```sh
   git push
   ```

6. Vercel will create a new deployment from the pushed commit if the repository is connected to a Vercel project.

## Notes

- This app currently stores job tracker data in the browser with `localStorage`, so data is local to each browser and device.
- If login, synced data, or multi-device access is needed later, add a backend such as Supabase before treating the app as a shared production tool.
- Do not commit temporary workspace folders such as `tmp/`.
