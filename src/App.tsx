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
import type { DocumentAttachment } from "@/lib/documentMatching";
import { useToast } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "firebase/auth";
import { SentryRoutes } from "@/instrument";

const queryClient = new QueryClient();

function ApplicationDetailRoute({ applications, onUpdate, onDelete, isDemo }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication>; onDelete: (id: string) => Promise<void>; isDemo: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = applications.find((a) => a.id === id);
  if (!app) return <NotFound />;
  return <ApplicationDetail application={app} onBack={() => navigate("/app/applications")} onUpdate={onUpdate} onDelete={onDelete} isDemo={isDemo} />;
}

// Keep application selection in the URL so details remain shareable and refresh-safe.
function ApplicationsListRoute({ applications, onUpdate, onDelete, isDemo, pendingAttachments, onAttachmentsComplete }: { applications: JobApplication[]; onUpdate: (application: JobApplication) => Promise<JobApplication>; onDelete: (id: string) => Promise<void>; isDemo: boolean; pendingAttachments: DocumentAttachment[]; onAttachmentsComplete: () => void }) {
  const navigate = useNavigate();

  // The list owns selection and confirmation while the shared hook remains the persistence boundary.
  return (
    <ApplicationsList
      applications={applications}
      onSelect={(application) => navigate(`/app/applications/${application.id}`)}
      onUpdate={onUpdate}
      onDelete={onDelete}
      isDemo={isDemo}
      pendingAttachments={pendingAttachments}
      onAttachmentsComplete={onAttachmentsComplete}
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
  backupApplications: (applications: JobApplication[], fileName: string, mode: ApplicationImportMode) => Promise<ImportBackup>;
  mergeApplications: (applications: JobApplication[]) => Promise<void>;
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
  const navigate = useNavigate();
  const [pendingImport, setPendingImport] = useState<{ file: File; result: WorkbookImportResult } | null>(null);
  const [pendingDocumentAttachments, setPendingDocumentAttachments] = useState<DocumentAttachment[]>([]);
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
      // The import transaction verifies its backup before invoking the additive cloud writer.
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
      });
      if (importMode === "replace") {
        // Owner snapshots are durable across browsers; demo snapshots remain intentionally device-local.
        const backupLocation = mode === "owner" ? "Firestore" : "this browser";
        toast({
          title: "Dataset replaced safely",
          description: `Replaced the active dataset with ${pendingImport.result.applications.length} jobs from the workbook. The previous dataset was backed up in ${backupLocation} first.`,
        });
      } else {
        const backupLocation = mode === "owner" ? "Firestore" : "this browser";
        toast({
          title: "Import merged safely",
          description: `Added ${pendingPlan.additions.length}, updated ${pendingPlan.updates.length}, and skipped ${pendingPlan.skipped.length} duplicate rows. No current jobs were deleted, and the previous dataset was backed up in ${backupLocation}.`,
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
          {authError && <Alert variant="destructive" className="mb-5"><AlertDescription>{authError}</AlertDescription></Alert>}
          {syncError && <Alert variant="destructive" className="mb-5"><AlertDescription>{syncError}</AlertDescription></Alert>}
          <Routes>
            <Route index element={<Dashboard applications={applications} isDemo={mode === "demo"} onImportXLSX={handleImportXLSX} />} />
            <Route path="applications" element={<ApplicationsListRoute applications={applications} onUpdate={updateApplication} onDelete={deleteApplication} isDemo={mode === "demo"} pendingAttachments={pendingDocumentAttachments} onAttachmentsComplete={() => setPendingDocumentAttachments([])} />} />
            <Route path="locations" element={<Locations applications={applications} />} />
            <Route path="applications/:id" element={<ApplicationDetailRoute applications={applications} onUpdate={updateApplication} onDelete={deleteApplication} isDemo={mode === "demo"} />} />
            <Route path="follow-ups" element={<FollowUps applications={applications} onUpdate={updateApplication} />} />
            <Route path="analytics" element={<Analytics applications={applications} isDemo={mode === "demo"} user={user} />} />
            {/* Device-local documents are scoped separately from the public demo and from other owner identities. */}
            <Route path="documents" element={<Documents applications={applications} mode={mode} ownerId={user?.uid} onUpdateApplication={updateApplication} onChooseApplication={(documents) => { setPendingDocumentAttachments(documents); navigate("/app/applications"); }} />} />
            <Route path="settings" element={<Settings mode={mode} user={user} syncing={syncing} offline={offline} />} />
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
        backupDestination={mode === "owner" ? "firestore" : "browser"}
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
    // Only the top-level route set is wrapped; nested route sets inherit the active Sentry navigation span.
    <SentryRoutes>
      <Route path="/" element={<Portfolio />} />
    </SentryRoutes>
  ) : (
    <SentryRoutes>
      <Route path="/app/*" element={<PublicJobTracker />} />
      <Route path="*" element={<NotFound />} />
    </SentryRoutes>
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
