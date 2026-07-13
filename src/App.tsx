import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import Portfolio from "@/pages/Portfolio";
import Dashboard from "@/pages/Dashboard";
import ApplicationsList from "@/pages/ApplicationsList";
import ApplicationDetail from "@/pages/ApplicationDetail";
import ApplicationForm from "@/pages/ApplicationForm";
import FollowUps from "@/pages/FollowUps";
import Locations from "@/pages/Locations";
import NotFound from "./pages/NotFound";
import { useApplications } from "@/hooks/useApplications";
import { useDemoApplications } from "@/hooks/useDemoApplications";
import { exportCSV, exportXLSX } from "@/lib/export";
import { importApplicationsFromFile, markSeeded, saveApplications } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "firebase/auth";

const queryClient = new QueryClient();

function ApplicationDetailRoute({ applications, onUpdate, onDelete, isDemo }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication>; onDelete: (id: string) => Promise<void>; isDemo: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = applications.find((a) => a.id === id);
  if (!app) return <NotFound />;
  return <ApplicationDetail application={app} onBack={() => navigate("/app/applications")} onUpdate={onUpdate} onDelete={onDelete} isDemo={isDemo} />;
}

// Keep application selection in the URL so details remain shareable and refresh-safe.
function ApplicationsListRoute({ applications, onUpdate, isDemo }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication>; isDemo: boolean }) {
  const navigate = useNavigate();

  return (
    <ApplicationsList
      applications={applications}
      onSelect={(application) => navigate(`/app/applications/${application.id}`)}
      onUpdate={onUpdate}
      isDemo={isDemo}
    />
  );
}

interface JobTrackerShellProps {
  applications: JobApplication[];
  loading: boolean;
  syncing: boolean;
  offline: boolean;
  syncError: string;
  createApplication: (input: Omit<JobApplication, "id" | "activityLog" | "createdAt" | "updatedAt">) => Promise<JobApplication>;
  updateApplication: (application: JobApplication) => Promise<JobApplication>;
  deleteApplication: (applicationId: string) => Promise<void>;
  replaceApplications: (applications: JobApplication[]) => Promise<void>;
  mode: "demo" | "owner";
  user?: User;
  authError?: string;
  onSignIn?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  onResetDemo?: () => Promise<void>;
}

// The shared shell keeps the public demo and private owner workspace visually identical.
function JobTrackerShell({
  applications,
  loading,
  syncing,
  offline,
  syncError,
  createApplication,
  updateApplication,
  deleteApplication,
  replaceApplications,
  mode,
  user,
  authError,
  onSignIn,
  onSignOut,
  onResetDemo,
}: JobTrackerShellProps) {
  const { toast } = useToast();

  async function handleImportXLSX(file: File) {
    // Imports remain owner-only so demo files and workbook metadata cannot enter the private migration store.
    if (mode === "demo") return;
    try {
      const { applications: imported, warnings } = await importApplicationsFromFile(file);
      await replaceApplications(imported);
      // Keep a recoverable browser backup only after the cloud replacement succeeds.
      saveApplications(imported);
      markSeeded();
      toast({ title: "Import complete", description: `Loaded ${imported.length} applications from ${file.name}.` });
      warnings.forEach((warning) => {
        toast({ title: "Import warning", description: warning });
      });
    } catch {
      toast({ title: "Import failed", description: "Could not read this file. Please verify the XLSX format.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading applications...</p>
      </div>
    );
  }

  return (
    <>
      <AppNavbar
        user={user}
        syncing={syncing}
        offline={offline}
        onSignOut={onSignOut}
        mode={mode}
        onSignIn={onSignIn}
        onResetDemo={onResetDemo}
        onExportCSV={() => exportCSV(applications)}
        onExportXLSX={() => exportXLSX(applications)}
        onImportXLSX={handleImportXLSX}
      />
      <main className="container py-8">
        {mode === "demo" && (
          <Alert className="mb-6">
            <AlertDescription>This is a public sandbox with synthetic data saved only in this browser. Log in with the approved Google account to open the private workspace.</AlertDescription>
          </Alert>
        )}
        {authError && <Alert variant="destructive" className="mb-6"><AlertDescription>{authError}</AlertDescription></Alert>}
        {syncError && <Alert variant="destructive" className="mb-6"><AlertDescription>{syncError}</AlertDescription></Alert>}
        <Routes>
          <Route index element={<Dashboard applications={applications} isDemo={mode === "demo"} user={user} />} />
          <Route path="applications" element={<ApplicationsListRoute applications={applications} onUpdate={updateApplication} isDemo={mode === "demo"} />} />
          <Route path="locations" element={<Locations applications={applications} />} />
          <Route path="applications/:id" element={<ApplicationDetailRoute applications={applications} onUpdate={updateApplication} onDelete={deleteApplication} isDemo={mode === "demo"} />} />
          <Route path="follow-ups" element={<FollowUps applications={applications} />} />
          <Route path="add" element={<ApplicationForm onCreate={createApplication} onUpdate={updateApplication} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

function OwnerJobTracker({ user }: { user: User }) {
  const { signOut } = useAuth();
  const data = useApplications(user);
  return <JobTrackerShell {...data} mode="owner" user={user} onSignOut={signOut} />;
}

function DemoJobTracker({ authError, onSignIn }: { authError: string; onSignIn: () => Promise<void> }) {
  const { resetDemo, ...data } = useDemoApplications();
  // Reset is a demo-only control, while the remaining data contract is shared with the owner shell.
  return <JobTrackerShell {...data} mode="demo" authError={authError} onSignIn={onSignIn} onResetDemo={resetDemo} />;
}

function PublicJobTracker() {
  const { user, loading, error, signInWithGoogle } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Checking your account...</p></div>;
  // Authentication selects the data source; it no longer decides whether the public product can render.
  return user ? <OwnerJobTracker user={user} /> : <DemoJobTracker authError={error} onSignIn={signInWithGoogle} />;
}

function AppContent() {
  const location = useLocation();
  // Portfolio is the public site; everything under /app/* is the Job Tracker app.
  const isPortfolio = location.pathname === "/" || location.pathname === "";

  return isPortfolio ? (
    <Routes>
      <Route path="/" element={<Portfolio />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/app/*" element={<PublicJobTracker />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
