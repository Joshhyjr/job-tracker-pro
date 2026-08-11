import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import JobTrackerSidebar from "@/components/JobTrackerSidebar";
import ImportConfirmationDialog from "@/components/ImportConfirmationDialog";
import Portfolio from "@/pages/Portfolio";
import Dashboard from "@/pages/Dashboard";
import ApplicationsList from "@/pages/ApplicationsList";
import ApplicationDetail from "@/pages/ApplicationDetail";
import ApplicationForm from "@/pages/ApplicationForm";
import FollowUps from "@/pages/FollowUps";
import Locations from "@/pages/Locations";
import Analytics from "@/pages/Analytics";
import Documents from "@/pages/Documents";
import Settings from "@/pages/Settings";
import NotFound from "./pages/NotFound";
import { useApplications } from "@/hooks/useApplications";
import { useDemoApplications } from "@/hooks/useDemoApplications";
import { exportCSV, exportXLSX } from "@/lib/export";
import { planApplicationImport } from "@/lib/applicationMerge";
import { applyConfirmedApplicationImport, type ApplicationImportMode } from "@/lib/applicationImport";
import { isSupportedExcelWorkbook } from "@/lib/excelFile";
import {
  importApplicationsFromFile,
  type ImportBackup,
  type WorkbookImportResult,
} from "@/lib/storage";
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
function ApplicationsListRoute({ applications, onUpdate, onDelete, isDemo }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication>; onDelete: (id: string) => Promise<void>; isDemo: boolean }) {
  const navigate = useNavigate();

  // The list owns selection and confirmation while the shared hook remains the persistence boundary.
  return (
    <ApplicationsList
      applications={applications}
      onSelect={(application) => navigate(`/app/applications/${application.id}`)}
      onUpdate={onUpdate}
      onDelete={onDelete}
      isDemo={isDemo}
    />
  );
}

interface JobTrackerShellProps {
  applications: JobApplication[];
  loading: boolean;
  syncing: boolean;
  pendingSyncCount: number;
  offline: boolean;
  syncError: string;
  createApplication: (input: Omit<JobApplication, "id" | "activityLog" | "createdAt" | "updatedAt">) => Promise<JobApplication>;
  updateApplication: (application: JobApplication) => Promise<JobApplication>;
  deleteApplication: (applicationId: string) => Promise<void>;
  backupApplications: (applications: JobApplication[], fileName: string, mode: ApplicationImportMode) => Promise<ImportBackup>;
  mergeApplications: (additions: JobApplication[], updates: JobApplication[]) => Promise<void>;
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
  pendingSyncCount,
  offline,
  syncError,
  createApplication,
  updateApplication,
  deleteApplication,
  backupApplications,
  mergeApplications,
  replaceApplications,
  mode,
  user,
  authError,
  onSignIn,
  onSignOut,
  onResetDemo,
}: JobTrackerShellProps) {
  const { toast } = useToast();
  const [pendingImport, setPendingImport] = useState<{ file: File; result: WorkbookImportResult } | null>(null);
  const [importMode, setImportMode] = useState<ApplicationImportMode>("merge");
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  // Recompute against live owner state so a realtime change while the dialog is open cannot be omitted.
  const pendingPlan = useMemo(
    () => pendingImport ? planApplicationImport(applications, pendingImport.result.applications) : null,
    [applications, pendingImport],
  );

  async function handleImportXLSX(file: File) {
    // Validate at the shared boundary before either the private owner or isolated demo flow parses a file.
    if (!isSupportedExcelWorkbook(file)) {
      toast({ title: "Import failed", description: "Only .xlsx Excel workbooks are supported.", variant: "destructive" });
      return;
    }
    try {
      // Parsing is a side-effect-free preview; import metadata changes only after explicit confirmation.
      const result = await importApplicationsFromFile(file, { persistMetadata: false });
      if (result.applications.length === 0) throw new Error("Workbook does not contain any valid application rows.");
      // Each newly selected workbook starts in the safest non-destructive mode.
      setImportMode("merge");
      setPendingImport({ file, result });
    } catch {
      toast({ title: "Import failed", description: "Could not read this file. Please verify the XLSX format.", variant: "destructive" });
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport || !pendingPlan || isApplyingImport) return;
    setIsApplyingImport(true);

    try {
      // The import transaction verifies browser recovery data before queueing additive cloud synchronization.
      await applyConfirmedApplicationImport({
        currentApplications: applications,
        fileName: pendingImport.file.name,
        result: pendingImport.result,
        plan: pendingPlan,
        mode: importMode,
        persistBackup: backupApplications,
        persistMerge: mergeApplications,
        persistReplacement: replaceApplications,
        storageScope: mode,
        ownerId: user?.uid,
      });
      if (importMode === "replace") {
        toast({
          title: "Dataset replaced safely",
          description: `Replaced the active dataset with ${pendingImport.result.applications.length} jobs from the workbook. The previous dataset was backed up in this browser first.`,
        });
      } else {
        const recoveryDescription = pendingPlan.updates.length > 0
          ? `The ${pendingPlan.updates.length} changed ${pendingPlan.updates.length === 1 ? "job was" : "jobs were"} backed up before updating.`
          : "No backup was needed because no current jobs were changed.";
        toast({
          title: mode === "owner" ? "Import saved in this browser" : "Import merged safely",
          // Owner imports are complete locally before Firestore is allowed to synchronize in the background.
          description: `Added ${pendingPlan.additions.length}, updated ${pendingPlan.updates.length}, and skipped ${pendingPlan.skipped.length} duplicate rows. No current jobs were deleted. ${recoveryDescription}${mode === "owner" ? " Cloud sync will continue in the background." : ""}`,
        });
      }
      pendingImport.result.warnings.forEach((warning) => {
        toast({ title: "Import warning", description: warning });
      });
      setPendingImport(null);
    } catch (error) {
      const description = error instanceof Error ? error.message : "The import merge could not be completed.";
      toast({ title: "Import not applied", description, variant: "destructive" });
    } finally {
      setIsApplyingImport(false);
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
    <div className="job-tracker min-h-screen bg-background text-foreground">
      <AppNavbar
        user={user}
        syncing={syncing}
        pendingSyncCount={pendingSyncCount}
        offline={offline}
        onSignOut={onSignOut}
        mode={mode}
        onSignIn={onSignIn}
        onResetDemo={onResetDemo}
        onExportCSV={() => exportCSV(applications)}
        onExportXLSX={() => exportXLSX(applications)}
        onImportXLSX={handleImportXLSX}
      />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <JobTrackerSidebar
          onExportCSV={() => exportCSV(applications)}
          onExportXLSX={() => exportXLSX(applications)}
          onImportXLSX={handleImportXLSX}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {/* Signed-out imports remain local because the demo hook persists only to its isolated browser namespace. */}
          {mode === "demo" && (
            <Alert className="mb-5 border-primary/20 bg-primary/5 py-2.5">
              <AlertDescription className="text-xs">Public demo: synthetic data is saved only in this browser. Log in with the approved Google account to open the private workspace.</AlertDescription>
            </Alert>
          )}
          {mode === "owner" && pendingSyncCount > 0 && (
            <Alert className="mb-5 border-amber-500/30 bg-amber-500/10 py-2.5">
              {/* Pending jobs remain fully usable from the verified UID-scoped browser outbox. */}
              <AlertDescription className="text-xs">{pendingSyncCount} {pendingSyncCount === 1 ? "job is" : "jobs are"} saved in this browser and waiting for Firestore. You can keep working; cloud sync retries automatically.</AlertDescription>
            </Alert>
          )}
          {authError && <Alert variant="destructive" className="mb-5"><AlertDescription>{authError}</AlertDescription></Alert>}
          {syncError && <Alert variant="destructive" className="mb-5"><AlertDescription>{syncError}</AlertDescription></Alert>}
          <Routes>
            <Route index element={<Dashboard applications={applications} isDemo={mode === "demo"} onImportXLSX={handleImportXLSX} />} />
            <Route path="applications" element={<ApplicationsListRoute applications={applications} onUpdate={updateApplication} onDelete={deleteApplication} isDemo={mode === "demo"} />} />
            <Route path="locations" element={<Locations applications={applications} />} />
            <Route path="applications/:id" element={<ApplicationDetailRoute applications={applications} onUpdate={updateApplication} onDelete={deleteApplication} isDemo={mode === "demo"} />} />
            <Route path="follow-ups" element={<FollowUps applications={applications} onUpdate={updateApplication} />} />
            <Route path="analytics" element={<Analytics applications={applications} isDemo={mode === "demo"} user={user} />} />
            {/* Device-local documents are scoped separately from the public demo and from other owner identities. */}
            <Route path="documents" element={<Documents applications={applications} mode={mode} ownerId={user?.uid} />} />
            <Route path="settings" element={<Settings mode={mode} user={user} syncing={syncing} pendingSyncCount={pendingSyncCount} offline={offline} />} />
            <Route path="add" element={<ApplicationForm onCreate={createApplication} onUpdate={updateApplication} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <ImportConfirmationDialog
        open={Boolean(pendingImport && pendingPlan)}
        fileName={pendingImport?.file.name ?? "workbook"}
        addedCount={pendingPlan?.additions.length ?? 0}
        updatedCount={pendingPlan?.updates.length ?? 0}
        skippedCount={pendingPlan?.skipped.length ?? 0}
        currentCount={applications.length}
        importedCount={pendingImport?.result.applications.length ?? 0}
        backupDestination="browser"
        mode={importMode}
        isApplying={isApplyingImport}
        onCancel={() => setPendingImport(null)}
        onModeChange={setImportMode}
        onConfirm={handleConfirmImport}
      />
    </div>
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
  // The reference app is light by default; users can still opt into dark mode from the app utility bar.
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
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
