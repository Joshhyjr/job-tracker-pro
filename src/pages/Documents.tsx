import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Link2, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { safeLocalStorageGetItem, safeLocalStorageRemoveItem, safeLocalStorageSetItem } from "@/lib/browserStorage";

type DocumentCategory = "Resumes" | "Cover letters" | "Job descriptions" | "Certificates" | "Other files";
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

export default function Documents({ applications, mode, ownerId }: { applications: JobApplication[]; mode: "demo" | "owner"; ownerId?: string }) {
  const storageKey = getStorageKey(mode, ownerId);
  const [documents, setDocuments] = useState<StoredDocument[]>(() => loadDocuments(storageKey, mode === "owner"));
  const [category, setCategory] = useState<DocumentCategory>("Resumes");
  const inputRef = useRef<HTMLInputElement>(null);
  const activeStorageKey = useRef(storageKey);
  const { toast } = useToast();
  const visible = useMemo(() => documents.filter((document) => document.category === category), [category, documents]);

  useEffect(() => {
    if (activeStorageKey.current === storageKey) return;
    activeStorageKey.current = storageKey;
    // Identity changes must replace in-memory files as well as switching the persistence namespace.
    setDocuments(loadDocuments(storageKey, mode === "owner"));
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
    setDocuments(next);
    return true;
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast({ title: "File too large", description: "Local document previews are limited to 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const saved = persist([{ id: crypto.randomUUID(), name: file.name, category, size: file.size, updatedAt: new Date().toISOString(), dataUrl: String(reader.result) }, ...documents]);
      if (saved) toast({ title: "Document uploaded", description: `${file.name} is available on this device.` });
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
      <section className="app-panel overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><span>Name</span><span>Used by</span><span className="w-10" /></div>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><FileText /></span><p className="text-sm font-semibold">No {category.toLowerCase()} yet</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">Upload a file to preview, download, rename, or connect it to an application.</p><Button variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}><Upload />Upload</Button></div>
        ) : visible.map((document) => {
          const usedBy = applications.filter((application) => Object.values(application.customFields || {}).some((value) => value === document.name)).length;
          return <div key={document.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{document.name}</span><span className="text-[10px] text-muted-foreground">{Math.max(1, Math.round(document.size / 1024))} KB · {new Date(document.updatedAt).toLocaleDateString()}</span></span></div><span className="whitespace-nowrap text-[11px] text-muted-foreground">{usedBy ? `${usedBy} applications` : "Not attached"}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${document.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><a href={document.dataUrl} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Preview</a></DropdownMenuItem><DropdownMenuItem asChild><a href={document.dataUrl} download={document.name}><Download className="mr-2 h-4 w-4" />Download</a></DropdownMenuItem><DropdownMenuItem onClick={() => { const name = window.prompt("Rename document", document.name)?.trim(); if (name) persist(documents.map((item) => item.id === document.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)); }}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem><DropdownMenuItem onClick={() => toast({ title: "Attach from an application", description: "Open an application and select this file in its document fields." })}><Link2 className="mr-2 h-4 w-4" />Attach to application</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => persist(documents.filter((item) => item.id !== document.id))}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
        })}
      </section>
      <p className="text-[10px] text-muted-foreground">Files in this document library are stored only in this browser. Existing application records and cloud sync are not changed.</p>
    </div>
  );
}
