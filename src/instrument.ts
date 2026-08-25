import { useEffect } from "react";
import {
  Routes,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
const vercelGitSha = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA;
// Prefer an explicit local override, then tag Vercel events with the immutable deployment commit.
const sentryRelease = import.meta.env.VITE_SENTRY_RELEASE
  || (vercelGitSha ? `job-tracker@${vercelGitSha}` : undefined);

if (sentryDsn) {
  // Initialize before the application tree so startup, render, and navigation failures are observable.
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    release: sentryRelease,
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    // Keep full local traces for setup while limiting production event volume.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Enable the structured logger used by the opt-in Sentry diagnostics control.
    enableLogs: true,
    // Propagate trace headers only to relative, same-origin application requests.
    tracePropagationTargets: [/^\//],
    dataCollection: {
      // Job application data is private, so diagnostic events exclude identity and request payload fields.
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: false,
        response: false,
      },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: {
        document: false,
        variables: false,
      },
      genAI: {
        inputs: false,
        outputs: false,
      },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
  });
}

// Keep local development usable without a DSN while enabling route-aware transaction names when configured.
export const SentryRoutes = sentryDsn ? Sentry.wrapReactRouterRouting(Routes) : Routes;
