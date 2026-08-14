import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Link2, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { safeLocalStorageGetItem, safeLocalStorageRemoveItem, safeLocalStorageSetItem } from "@/lib/browserStorage";
import { isPreviewableDocumentDataUrl } from "@/lib/documentPreview";
import {
  findDocumentApplicationMatch,
  getApplicationDocumentField,
  getDocumentSelectionError,
  inferDocumentCategory,
  type DocumentAttachment,
  type DocumentCategory,
} from "@/lib/documentMatching";

type StoredDocument = { id: string; name: string; category: DocumentCategory; size: number; updatedAt: string; dataUrl: string };
const CATEGORIES: DocumentCategory[] = ["Resumes", "Cover letters", "Job descriptions", "Certificates", "Other files"];
const LEGACY_STORAGE_KEY = "job-tracker-documents-v1";
const STORAGE_KEY_PREFIX = "job-tracker-documents-v2";

function getStorageKey(mode: "demo" | "owner", ownerId?: string): string | null {
  if (mode === "demo") return `${STORAGE_KEY_PREFIX}:demo`;
  // Owner storage fails closed until Firebase supplies an identity, preventing accidental cross-account reuse.
  return ownerId ? `${STORAGE_KEY_PREFIX}:owner:${ownerId}` : null;
}

function isStoredDocument(value: unknown): value is StoredDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<StoredDocument>;
  return typeof document.id === "string"
    && typeof document.name === "string"
    && CATEGORIES.includes(document.category as DocumentCategory)
    && typeof document.size === "number"
    && Number.isFinite(document.size)
    && document.size >= 0
    && typeof document.updatedAt === "string"
    && typeof document.dataUrl === "string"
    && document.dataUrl.startsWith("data:");
}

function parseDocuments(raw: string): StoredDocument[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every(isStoredDocument) ? parsed : null;
  } catch {
    return null;
  }
}

function loadDocuments(storageKey: string | null, migrateLegacyOwnerDocuments: boolean): StoredDocument[] {
  if (!storageKey) return [];
  const scopedRaw = safeLocalStorageGetItem(storageKey);
  if (scopedRaw !== null) return parseDocuments(scopedRaw) ?? [];
  if (!migrateLegacyOwnerDocuments) return [];

  const legacyRaw = safeLocalStorageGetItem(LEGACY_STORAGE_KEY);
  if (legacyRaw === null) return [];
  const legacyDocuments = parseDocuments(legacyRaw);
  if (!legacyDocuments) return [];

  // Migrate the old shared key only after authentication, and retain it if the scoped write cannot be verified.
  const serialized = JSON.stringify(legacyDocuments);
  safeLocalStorageSetItem(storageKey, serialized);
  if (safeLocalStorageGetItem(storageKey) === serialized) safeLocalStorageRemoveItem(LEGACY_STORAGE_KEY);
  return legacyDocuments;
}

export default function Documents({
  applications,
  mode,
  ownerId,
  onUpdateApplication,
  onChooseApplication,
}: {
  applications: JobApplication[];
  mode: "demo" | "owner";
  ownerId?: string;
  onUpdateApplication?: (application: JobApplication) => Promise<JobApplication>;
  onChooseApplication?: (documents: DocumentAttachment[]) => void;
}) {
  const storageKey = getStorageKey(mode, ownerId);
  const [documents, setDocuments] = useState<StoredDocument[]>(() => loadDocuments(storageKey, mode === "owner"));
  const [category, setCategory] = useState<DocumentCategory>("Resumes");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const activeStorageKey = useRef(storageKey);
  const documentsRef = useRef(documents);
  const applicationsRef = useRef(applications);
  const updateApplicationRef = useRef(onUpdateApplication);
  const pendingDocumentLinks = useRef(new Map<string, string>());
  const applicationUpdateQueues = useRef(new Map<string, Promise<void>>());
  const { toast } = useToast();
  const visible = useMemo(() => documents.filter((document) => document.category === category), [category, documents]);
  const selectedDocuments = useMemo(
    () => documents.filter((document) => selectedDocumentIds.has(document.id)),
    [documents, selectedDocumentIds],
  );

  useEffect(() => {
    applicationsRef.current = applications;
    updateApplicationRef.current = onUpdateApplication;
    // Once realtime data contains a link, its cloud value supersedes the temporary in-flight guard.
    applications.forEach((application) => {
      (["Resume Used", "Cover Letter Used"] as const).forEach((field) => {
        if (application.customFields?.[field]) pendingDocumentLinks.current.delete(`${application.id}\u0000${field}`);
      });
    });
  }, [applications, onUpdateApplication]);

  useEffect(() => {
    if (activeStorageKey.current === storageKey) return;
    activeStorageKey.current = storageKey;
    // Identity changes must replace in-memory files as well as switching the persistence namespace.
    const scopedDocuments = loadDocuments(storageKey, mode === "owner");
    documentsRef.current = scopedDocuments;
    setDocuments(scopedDocuments);
  }, [mode, storageKey]);

  function persist(next: StoredDocument[]): boolean {
    if (!storageKey) {
      toast({ title: "Document not saved", description: "Your account identity is not available yet. Please retry.", variant: "destructive" });
      return false;
    }
    // Verify device-local persistence before updating the UI so quota failures never look like successful saves.
    const serialized = JSON.stringify(next);
    safeLocalStorageSetItem(storageKey, serialized);
    if (safeLocalStorageGetItem(storageKey) !== serialized) {
      toast({ title: "Document not saved", description: "This browser could not store the file. Free some site storage and retry.", variant: "destructive" });
      return false;
    }
    // A verified owner write supersedes any legacy recovery copy left behind by an earlier quota failure.
    if (mode === "owner") safeLocalStorageRemoveItem(LEGACY_STORAGE_KEY);
    // Keep rapid consecutive uploads based on the latest durable list instead of a stale render closure.
    documentsRef.current = next;
    setDocuments(next);
    return true;
  }

  const attachToMatchingApplication = useCallback(async (
    document: StoredDocument,
    options: { uploaded?: boolean; automatic?: boolean } = {},
  ) => {
    const { uploaded = false, automatic = false } = options;
    const field = getApplicationDocumentField(document.category);
    if (!field) {
      if (uploaded) toast({ title: "Document uploaded", description: `${document.name} is available on this device.` });
      return;
    }

    const match = findDocumentApplicationMatch(document.name, applicationsRef.current);
    if (match.status !== "matched") {
      // Background reconciliation stays quiet for files that need a clearer user-supplied filename.
      if (automatic) return;
      const description = match.status === "ambiguous"
        ? "More than one application matches this filename. Add the job title to the name and retry."
        : "No clear company match was found in the filename.";
      toast({ title: uploaded ? "Document uploaded — not attached" : "Document not attached", description });
      return;
    }

    const pendingKey = `${match.application.id}\u0000${field}`;
    const currentDocument = match.application.customFields?.[field] || pendingDocumentLinks.current.get(pendingKey);
    if (currentDocument === document.name) {
      if (automatic) return;
      toast({ title: uploaded ? "Document uploaded" : "Already attached", description: `${document.name} is attached to ${match.application.companyName} — ${match.application.jobTitle}.` });
      return;
    }
    if (currentDocument) {
      if (automatic) return;
      toast({
        title: uploaded ? "Document uploaded — existing attachment kept" : "Existing attachment kept",
        description: `${match.application.companyName} — ${match.application.jobTitle} already uses ${currentDocument}.`,
      });
      return;
    }
    const updateApplication = updateApplicationRef.current;
    if (!updateApplication) {
      if (automatic) return;
      toast({ title: "Document not attached", description: "Application updates are not available right now.", variant: "destructive" });
      return;
    }

    // Reserve this application field before awaiting Firestore so simultaneous scans cannot overwrite one another.
    pendingDocumentLinks.current.set(pendingKey, document.name);
    const applicationId = match.application.id;
    const previousUpdate = applicationUpdateQueues.current.get(applicationId) ?? Promise.resolve();
    // Serialize full-record writes per application so a resume and cover letter cannot save stale snapshots concurrently.
    const queuedUpdate = previousUpdate.catch(() => undefined).then(async () => {
      try {
        // Rebase after the preceding save, preserving every attachment and timeline entry it added.
        const latestApplication = applicationsRef.current.find((application) => application.id === applicationId) ?? match.application;
        const latestDocument = latestApplication.customFields?.[field];
        if (latestDocument === document.name) return;
        if (latestDocument) {
          if (pendingDocumentLinks.current.get(pendingKey) === document.name) pendingDocumentLinks.current.delete(pendingKey);
          if (!automatic) {
            toast({
              title: uploaded ? "Document uploaded — existing attachment kept" : "Existing attachment kept",
              description: `${latestApplication.companyName} — ${latestApplication.jobTitle} already uses ${latestDocument}.`,
            });
          }
          return;
        }

        const now = new Date().toISOString();
        // Record the automatic link in both the existing document field and the application timeline for traceability.
        const updatedApplication: JobApplication = {
          ...latestApplication,
          customFields: { ...(latestApplication.customFields || {}), [field]: document.name },
          activityLog: [{ id: crypto.randomUUID(), date: now, type: "note", message: `Attached ${document.name} as ${field}` }, ...(latestApplication.activityLog || [])],
        };
        const savedApplication = await updateApplication(updatedApplication);
        // Preserve this attachment as the base for later queued writes before realtime props refresh.
        applicationsRef.current = applicationsRef.current.map((application) => application.id === savedApplication.id ? savedApplication : application);
        toast({ title: uploaded ? "Document uploaded and attached" : automatic ? "Document attached automatically" : "Document attached", description: `${document.name} is linked to ${latestApplication.companyName} — ${latestApplication.jobTitle}.` });
      } catch {
        if (pendingDocumentLinks.current.get(pendingKey) === document.name) pendingDocumentLinks.current.delete(pendingKey);
        toast({ title: uploaded ? "Document uploaded — attachment failed" : "Document not attached", description: "The file is safe in this browser, but the application update failed. Please retry.", variant: "destructive" });
      }
    });
    applicationUpdateQueues.current.set(applicationId, queuedUpdate);
    const clearFinishedQueue = () => {
      if (applicationUpdateQueues.current.get(applicationId) === queuedUpdate) applicationUpdateQueues.current.delete(applicationId);
    };
    // Cleanup handles both outcomes without creating an unobserved rejected promise.
    void queuedUpdate.then(clearFinishedQueue, clearFinishedQueue);
    await queuedUpdate;
  }, [toast]);

  function chooseApplication(documentsToAttach: StoredDocument[]) {
    const selectionError = getDocumentSelectionError(documentsToAttach);
    if (selectionError) {
      toast({ title: "Files not ready to attach", description: selectionError, variant: "destructive" });
      return;
    }
    if (!onChooseApplication) {
      toast({ title: "Application list unavailable", description: "Please retry after the page finishes loading.", variant: "destructive" });
      return;
    }

    // Pass only attachment metadata; device-local file contents never leave the Documents storage boundary.
    onChooseApplication(documentsToAttach.map(({ id, name, category: documentCategory }) => ({ id, name, category: documentCategory })));
  }

  useEffect(() => {
    if (!onUpdateApplication) return;
    // Reconcile files that predate filename matching as soon as both local documents and applications are available.
    documents.forEach((document) => void attachToMatchingApplication(document, { automatic: true }));
  }, [applications, attachToMatchingApplication, documents, onUpdateApplication]);

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast({ title: "File too large", description: "Local document previews are limited to 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      // Filename labels can correct an accidentally selected tab before matching the company and role.
      const inferredCategory = inferDocumentCategory(file.name, category);
      const document = { id: crypto.randomUUID(), name: file.name, category: inferredCategory, size: file.size, updatedAt: new Date().toISOString(), dataUrl: String(reader.result) };
      const saved = persist([document, ...documentsRef.current]);
      if (saved) {
        setCategory(inferredCategory);
        await attachToMatchingApplication(document, { uploaded: true });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Documents" description="Keep job-search files organized and ready to attach." actions={<Button size="sm" onClick={() => inputRef.current?.click()}><Upload />Upload file</Button>} />
      <input ref={inputRef} className="hidden" type="file" aria-label="Upload document" onChange={upload} />
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Document categories">
        {CATEGORIES.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold ${category === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setCategory(item)}>{item} <span className="ml-1 text-[10px]">({documents.filter((document) => document.category === item).length})</span></button>)}
      </div>
      {selectedDocuments.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold" aria-live="polite">{selectedDocuments.length} file{selectedDocuments.length === 1 ? "" : "s"} selected</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedDocumentIds(new Set())}>Clear</Button>
            <Button size="sm" onClick={() => chooseApplication(selectedDocuments)}><Link2 />Attach selected to application</Button>
          </div>
        </div>
      )}
      <section className="app-panel overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><span className="w-4"><span className="sr-only">Select</span></span><span>Name</span><span>Used by</span><span className="w-10" /></div>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><FileText /></span><p className="text-sm font-semibold">No {category.toLowerCase()} yet</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">Upload a file to preview, download, rename, or connect it to an application.</p><Button variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}><Upload />Upload</Button></div>
        ) : visible.map((document) => {
          const usedBy = applications.filter((application) => Object.values(application.customFields || {}).some((value) => value === document.name));
          const usedByLabel = usedBy.length === 1 ? `${usedBy[0].companyName} — ${usedBy[0].jobTitle}` : usedBy.length > 1 ? `${usedBy.length} applications` : "Not attached";
          const attachmentField = getApplicationDocumentField(document.category);
          const canPreview = isPreviewableDocumentDataUrl(document.dataUrl);
          return <div key={document.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"><Checkbox disabled={!attachmentField} aria-label={`Select ${document.name}`} checked={selectedDocumentIds.has(document.id)} onCheckedChange={(checked) => setSelectedDocumentIds((current) => { const next = new Set(current); if (checked === true) next.add(document.id); else next.delete(document.id); return next; })} /><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{document.name}</span><span className="text-[10px] text-muted-foreground">{Math.max(1, Math.round(document.size / 1024))} KB · {new Date(document.updatedAt).toLocaleDateString()}</span></span></div><span className="max-w-64 truncate whitespace-nowrap text-[11px] text-muted-foreground" title={usedByLabel}>{usedByLabel}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${document.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{canPreview && <DropdownMenuItem asChild><a href={document.dataUrl} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Preview</a></DropdownMenuItem>}<DropdownMenuItem asChild><a href={document.dataUrl} download={document.name}><Download className="mr-2 h-4 w-4" />Download</a></DropdownMenuItem><DropdownMenuItem onClick={() => { const name = window.prompt("Rename document", document.name)?.trim(); if (name) persist(documents.map((item) => item.id === document.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)); }}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>{attachmentField && <DropdownMenuItem onClick={() => chooseApplication([document])}><Link2 className="mr-2 h-4 w-4" />Choose existing application</DropdownMenuItem>}<DropdownMenuItem className="text-destructive" onClick={() => persist(documents.filter((item) => item.id !== document.id))}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
        })}
      </section>
      <p className="text-[10px] text-muted-foreground">Files stay in this browser. Resume and cover-letter filenames are matched to a single clear company/job, and only the filename link is synced to that application.</p>
    </div>
  );
}
