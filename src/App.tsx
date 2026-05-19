import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import Dashboard from "@/pages/Dashboard";
import ApplicationsList from "@/pages/ApplicationsList";
import ApplicationDetail from "@/pages/ApplicationDetail";
import ApplicationForm from "@/pages/ApplicationForm";
import FollowUps from "@/pages/FollowUps";
import NotFound from "./pages/NotFound";
import { useApplications } from "@/hooks/useApplications";
import { exportCSV, exportXLSX } from "@/lib/export";
import { importApplicationsFromFile, markSeeded, saveApplications } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

function ApplicationDetailRoute({ applications, onUpdate }: { applications: JobApplication[]; onUpdate: () => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = applications.find((a) => a.id === id);
  if (!app) return <NotFound />;
  return <ApplicationDetail application={app} onBack={() => navigate("/applications")} onUpdate={onUpdate} />;
}

function AppContent() {
  const { applications, loading, refresh } = useApplications();
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const { toast } = useToast();

  async function handleImportXLSX(file: File) {
    try {
      const { applications: imported, warnings } = await importApplicationsFromFile(file);
      saveApplications(imported);
      markSeeded();
      refresh();
      setSelectedApp(null);
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
      {/* Main content area with generous padding */}
      <main className="container py-8">
        <Routes>
          <Route path="/" element={<Dashboard applications={applications} />} />
          <Route
            path="/applications"
            element={
              selectedApp ? (
                <ApplicationDetail application={selectedApp} onBack={() => setSelectedApp(null)} onUpdate={() => { refresh(); setSelectedApp(null); }} />
              ) : (
                <ApplicationsList applications={applications} onSelect={setSelectedApp} onUpdate={refresh} />
              )
            }
          />
          <Route path="/follow-ups" element={<FollowUps applications={applications} />} />
          <Route path="/add" element={<ApplicationForm onSaved={refresh} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
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
