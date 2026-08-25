import "./instrument";

import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
// Cockpit typography — Space Grotesk (display), Inter (body), JetBrains Mono (readouts).
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import App from "./App.tsx";
import { AppErrorFallback } from "./components/AppErrorFallback.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  // React 18 needs an error boundary to report render failures and keep a usable fallback on screen.
  <Sentry.ErrorBoundary fallback={({ resetError }) => <AppErrorFallback resetError={resetError} />}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </Sentry.ErrorBoundary>,
);
