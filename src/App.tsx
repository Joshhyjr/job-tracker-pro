import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import Dashboard from "@/pages/Dashboard";
import ApplicationsList from "@/pages/ApplicationsList";
import ApplicationDetail from "@/pages/ApplicationDetail";
import ApplicationForm from "@/pages/ApplicationForm";
import FollowUps from "@/pages/FollowUps";
import NotFound from "./pages/NotFound";
import { useApplications } from "@/hooks/useApplications";
import { exportCSV, exportXLSX } from "@/lib/export";
import type { JobApplication } from "@/lib/types";

const queryClient = new QueryClient();

function AppContent() {
  const { applications, loading, refresh } = useApplications();
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading applications...</p>
      </div>
    );
  }

  return (
    <>
      <AppNavbar onExportCSV={() => exportCSV(applications)} onExportXLSX={() => exportXLSX(applications)} />
      <main className="container py-6">
        <Routes>
          <Route path="/" element={<Dashboard applications={applications} />} />
          <Route
            path="/applications"
            element={
              selectedApp ? (
                <ApplicationDetail application={selectedApp} onBack={() => setSelectedApp(null)} onUpdate={() => { refresh(); setSelectedApp(null); }} />
              ) : (
                <ApplicationsList applications={applications} onSelect={setSelectedApp} />
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
