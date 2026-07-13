# Deployment Guide

This site is a Vite, React, TypeScript, shadcn-ui, and Tailwind CSS application. Vercel hosts the frontend and the server-side Gemini AI Insights function.

## Current Vercel Setup

- Platform: Vercel
- Node.js runtime: 22.x (required by the Firebase Admin SDK)
- Deployment type: Preview deployment first
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `GEMINI_API_KEY` plus `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` are required for hosted AI Insights; `GEMINI_MODEL` optionally overrides `gemini-3.5-flash`
- Routing: `vercel.json` rewrites all routes to `index.html` so React Router pages work when refreshed or opened directly

## How This Was Deployed

1. Add `GEMINI_API_KEY` and the Firebase Admin service-account fields to the Vercel project's Development, Preview, and Production environments:

   ```sh
   FIREBASE_ADMIN_PROJECT_ID="your-project-id"
   FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-...@your-project.iam.gserviceaccount.com"
   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GEMINI_MODEL="gemini-3.5-flash"
   ```

   Create the credentials from **Firebase Console → Project settings → Service accounts** and never commit the downloaded JSON file. Keep the Gemini key, Admin email, and Admin private key server-side and never name them with a `VITE_` prefix. Preserve private-key newlines either literally or as escaped `\n` sequences. Redeploy after changing environment variables. The dashboard then uses the signed-in owner's short-lived Firebase ID token automatically; no shared access token is needed. Gemini's free tier has usage limits, and Google may use free-tier requests to improve its products.

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

## Production Rate Limiting

The API functions enforce a per-instance fallback of 5 contact submissions per minute and 12 authenticated AI requests per minute for each client IP. Because Vercel Functions can run on multiple instances, configure Vercel Firewall as the distributed production boundary as well; no environment variables are required.

1. Open the Vercel project, select **Firewall**, choose **Configure**, and create a new custom rule.
2. If your plan permits two rate-limit rules, publish both of these fixed-window, IP-keyed rules with the default `429` action:
   - Request Path equals `/api/contact`, Request Method equals `POST`, 5 requests per 60 seconds.
   - Request Path equals `/api/ai-insights`, Request Method equals `POST`, 12 requests per 60 seconds.
3. If your plan permits only one rate-limit rule, use Request Path starts with `/api/`, Request Method equals `POST`, and 10 requests per 60 seconds. The code-level per-endpoint limits remain as a second layer.
4. Review and publish the firewall changes, then confirm blocked traffic appears in the Firewall overview.

Start with Vercel's **Log** action if you want to observe normal traffic before switching to the default `429` response. Keep the IP counting key so one abusive source does not consume the allowance for every visitor.

## Notes

- Signed-in job tracker data synchronizes through Cloud Firestore, with Firestore's persistent browser cache supporting trusted-device offline use.
- Hosted AI Insights sends only summarized application metrics to Gemini; notes, links, recruiters, custom fields, and complete application records are not sent to Gemini.
- The Gemini endpoint verifies the Firebase bearer ID token and the approved owner email in addition to same-origin, payload, and application-level rate-limit protections. Keep the Vercel Firewall limits above enabled and configure provider spend alerts.
- Google Authentication and Firestore Security Rules restrict cloud data to the approved verified account; deploy rule changes alongside application changes.
- Do not commit temporary workspace folders such as `tmp/`.
