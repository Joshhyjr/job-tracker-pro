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

const queryClient = new QueryClient();

function ApplicationDetailRoute({ applications, onUpdate }: { applications: JobApplication[]; onUpdate: (updatedApplication?: JobApplication) => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = applications.find((a) => a.id === id);
  if (!app) return <NotFound />;
  return <ApplicationDetail application={app} onBack={() => navigate("/app/applications")} onUpdate={onUpdate} />;
}

// Keep application selection in the URL so details remain shareable and refresh-safe.
function ApplicationsListRoute({ applications, onUpdate }: { applications: JobApplication[]; onUpdate: (updatedApplication?: JobApplication) => void }) {
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
  const { applications, loading, refresh } = useApplications();
  const { toast } = useToast();

  async function handleImportXLSX(file: File) {
    try {
      const { applications: imported, warnings } = await importApplicationsFromFile(file);
      saveApplications(imported);
      markSeeded();
      refresh();
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
      <AppNavbar onExportCSV={() => exportCSV(applications)} onExportXLSX={() => exportXLSX(applications)} onImportXLSX={handleImportXLSX} />
      <main className="container py-8">
        <Routes>
          <Route index element={<Dashboard applications={applications} />} />
          <Route path="applications" element={<ApplicationsListRoute applications={applications} onUpdate={refresh} />} />
          <Route path="locations" element={<Locations applications={applications} />} />
          <Route path="applications/:id" element={<ApplicationDetailRoute applications={applications} onUpdate={refresh} />} />
          <Route path="follow-ups" element={<FollowUps applications={applications} />} />
          <Route path="add" element={<ApplicationForm onSaved={refresh} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
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
      <Route path="/app/*" element={<JobTrackerApp />} />
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
