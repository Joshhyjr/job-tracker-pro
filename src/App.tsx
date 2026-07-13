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
import { exportCSV, exportXLSX } from "@/lib/export";
import { importApplicationsFromFile, markSeeded, saveApplications } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const queryClient = new QueryClient();

function ApplicationDetailRoute({ applications, onUpdate, onDelete }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication>; onDelete: (id: string) => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = applications.find((a) => a.id === id);
  if (!app) return <NotFound />;
  return <ApplicationDetail application={app} onBack={() => navigate("/app/applications")} onUpdate={onUpdate} onDelete={onDelete} />;
}

// Keep application selection in the URL so details remain shareable and refresh-safe.
function ApplicationsListRoute({ applications, onUpdate }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication> }) {
  const navigate = useNavigate();

  return (
    <ApplicationsList
      applications={applications}
      onSelect={(application) => navigate(`/app/applications/${application.id}`)}
      onUpdate={onUpdate}
    />
  );
}

// Job Tracker app shell — only mounted under /app/* so the portfolio at / stays clean.
function JobTrackerApp() {
  const { user, signOut } = useAuth();
  const { applications, loading, syncing, offline, syncError, createApplication, updateApplication, deleteApplication, replaceApplications } = useApplications(user!);
  const { toast } = useToast();

  async function handleImportXLSX(file: File) {
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
        user={user!}
        syncing={syncing}
        offline={offline}
        onSignOut={signOut}
        onExportCSV={() => exportCSV(applications)}
        onExportXLSX={() => exportXLSX(applications)}
        onImportXLSX={handleImportXLSX}
      />
      <main className="container py-8">
        {syncError && <Alert variant="destructive" className="mb-6"><AlertDescription>{syncError}</AlertDescription></Alert>}
        <Routes>
          <Route index element={<Dashboard applications={applications} />} />
          <Route path="applications" element={<ApplicationsListRoute applications={applications} onUpdate={updateApplication} />} />
          <Route path="locations" element={<Locations applications={applications} />} />
          <Route path="applications/:id" element={<ApplicationDetailRoute applications={applications} onUpdate={updateApplication} onDelete={deleteApplication} />} />
          <Route path="follow-ups" element={<FollowUps applications={applications} />} />
          <Route path="add" element={<ApplicationForm onCreate={createApplication} onUpdate={updateApplication} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

function AuthenticatedJobTracker() {
  const { user, loading, error, signInWithGoogle } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Checking your account...</p></div>;
  if (user) return <JobTrackerApp />;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md space-y-5 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold">Sign in to Job Tracker</h1>
        <p className="text-sm text-muted-foreground">Use the approved Google account to securely sync applications across devices.</p>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button onClick={() => void signInWithGoogle()} className="w-full">Continue with Google</Button>
      </div>
    </div>
  );
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
      <Route path="/app/*" element={<AuthenticatedJobTracker />} />
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
