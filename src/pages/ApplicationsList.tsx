import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpDown,
  CalendarDays,
  ExternalLink,
  FilterX,
  GripVertical,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { ResponseStatusSelect } from "@/components/ResponseStatusSelect";
import { CompanyLogo } from "@/components/CompanyLogo";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import {
  buildResponseStatusChangeApplication,
  getEffectiveCurrentStatus,
  normalizeResponseStatus,
  normalizeResponseStatusList,
} from "@/lib/responseStatus";
import { generateId, getPreferredResponseStatusOrder } from "@/lib/storage";
import { sanitizeExternalHttpUrl } from "@/lib/security";
import {
  buildApplicationDocumentAttachment,
  getDocumentSelectionError,
  type DocumentAttachment,
} from "@/lib/documentMatching";
import type { CurrentStatus, JobApplication } from "@/lib/types";
import { CURRENT_STATUSES, RESPONSE_STATUSES } from "@/lib/types";
import { cn, formatDisplayDate } from "@/lib/utils";
import { parseJobLocation } from "@/lib/geography";

type DateFilterMode = "any" | "date" | "range" | "month" | "year";
type ViewMode = "list" | "board";
const BOARD_COLUMNS = ["Applied", "Auto-reply received", "No Response", "Pre-screen call", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];

interface ApplicationsListProps {
  applications: JobApplication[];
  onSelect: (app: JobApplication) => void;
  onUpdate: (application: JobApplication) => Promise<JobApplication>;
  onDelete: (id: string) => Promise<void>;
  isDemo?: boolean;
  readOnly?: boolean;
  pendingAttachments?: DocumentAttachment[];
  onAttachmentsComplete?: () => void;
}

export default function ApplicationsList({ applications, onSelect, onUpdate, onDelete, isDemo = false, readOnly = false, pendingAttachments = [], onAttachmentsComplete }: ApplicationsListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("range");
  const [dateFilterValue, setDateFilterValue] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attachingApplicationId, setAttachingApplicationId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});
  const pendingStatusIds = useRef(new Set<string>());
  const moveApplicationRef = useRef(moveApplication);
  // Toast actions can outlive a render, so undo must use the latest dataset and save guards.
  moveApplicationRef.current = moveApplication;
  const [savingStatusIds, setSavingStatusIds] = useState<Set<string>>(() => new Set());
  // Imported stages stay selectable and visible on the board after an inline change.
  const statusOptions = useMemo(() => normalizeResponseStatusList([
    ...(isDemo ? [] : getPreferredResponseStatusOrder()), ...RESPONSE_STATUSES, "Withdrawn",
    ...applications.map((application) => application.responseStatus),
  ]), [applications, isDemo]);
  const boardColumns = normalizeResponseStatusList([...BOARD_COLUMNS, ...statusOptions, ...Object.values(optimisticStatuses)]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const activeStatus = searchParams.get("status") as CurrentStatus | null;
  const activeResponseStatus = searchParams.get("responseStatus");
  const activeCountryCode = searchParams.get("country");
  const isAttachmentMode = pendingAttachments.length > 0;
  const { toast } = useToast();
  // Drawer links revalidate legacy and imported records before exposing a browser navigation target.
  const selectedJobPostingHref = sanitizeExternalHttpUrl(selectedApplication?.jobLink);

  useEffect(() => {
    // Release optimistic board labels only after the parent dataset confirms the persisted response status.
    setOptimisticStatuses((current) => {
      const next = { ...current };
      let changed = false;
      Object.entries(next).forEach(([id, status]) => {
        const application = applications.find((item) => item.id === id);
        if (application && normalizeResponseStatus(application.responseStatus) === status) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [applications]);

  function setFilters(next: { status?: CurrentStatus; responseStatus?: string }) {
    const nextParams = new URLSearchParams();
    if (next.status) nextParams.set("status", next.status);
    if (next.responseStatus) nextParams.set("responseStatus", next.responseStatus);
    setSearchParams(nextParams);
    setPage(1);
  }

  const filtered = useMemo(() => {
    let list = applications;
    if (activeStatus) list = list.filter((application) => getEffectiveCurrentStatus(application) === activeStatus);
    if (activeResponseStatus) list = list.filter((application) => normalizeResponseStatus(application.responseStatus) === activeResponseStatus);
    // Country links use ISO codes so filtering cannot confuse cities, aliases, or work modes with countries.
    if (activeCountryCode) list = list.filter((application) => parseJobLocation(application).countryCode === activeCountryCode.toUpperCase());
    if (search) {
      const query = search.toLowerCase();
      list = list.filter((application) => [application.jobTitle, application.companyName, application.location, application.notes].some((field) => field.toLowerCase().includes(query)));
    }
    if (companyFilter.trim()) list = list.filter((application) => application.companyName.toLowerCase().includes(companyFilter.trim().toLowerCase()));
    if (dateFilterMode === "range" && (dateFilterValue || dateFilterEnd)) {
      list = list.filter((application) => {
        if (!application.dateApplied) return false;
        if (dateFilterValue && application.dateApplied < dateFilterValue) return false;
        return !(dateFilterEnd && application.dateApplied > dateFilterEnd);
      });
    } else if (dateFilterMode !== "any" && dateFilterValue) {
      list = list.filter((application) => dateFilterMode === "year" ? application.dateApplied.startsWith(dateFilterValue) : dateFilterMode === "month" ? application.dateApplied.startsWith(`${dateFilterValue}-`) : application.dateApplied === dateFilterValue);
    }
    return [...list].sort((a, b) => sortAsc ? (a.dateApplied || "").localeCompare(b.dateApplied || "") : (b.dateApplied || "").localeCompare(a.dateApplied || ""));
  }, [activeCountryCode, activeResponseStatus, activeStatus, applications, companyFilter, dateFilterEnd, dateFilterMode, dateFilterValue, search, sortAsc]);

  const filteredIds = useMemo(() => filtered.map((application) => application.id), [filtered]);
  const selectedFilteredIds = useMemo(() => filteredIds.filter((id) => selectedIds.has(id)), [filteredIds, selectedIds]);
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;
  const hasActiveFilters = Boolean(search || companyFilter.trim() || dateFilterValue || dateFilterEnd || activeStatus || activeResponseStatus || activeCountryCode);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedApplications = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const tableColumnCount = readOnly ? 6 : 7;

  function currentResponseStatus(application: JobApplication) {
    return optimisticStatuses[application.id] || normalizeResponseStatus(application.responseStatus);
  }

  function setDateMode(mode: DateFilterMode) {
    // Reset incompatible values so hidden date controls never keep filtering results.
    setDateFilterMode(mode);
    setDateFilterValue("");
    setDateFilterEnd("");
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setCompanyFilter("");
    setDateFilterMode("range");
    setDateFilterValue("");
    setDateFilterEnd("");
    setFilters({});
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      // Bulk selection deliberately follows all filtered results, not only the visible page.
      filteredIds.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  async function handleBulkDelete() {
    if (isDeleting || selectedFilteredIds.length === 0) return;
    const deleted: string[] = [];
    let failures = 0;
    setIsDeleting(true);
    for (const id of selectedFilteredIds) {
      try { await onDelete(id); deleted.push(id); } catch { failures += 1; }
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      deleted.forEach((id) => next.delete(id));
      return next;
    });
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    toast(failures ? { title: "Some applications were not deleted", description: `${deleted.length} deleted, ${failures} failed. The failed applications remain selected so you can retry.`, variant: "destructive" } : { title: "Applications deleted", description: `${deleted.length} application${deleted.length === 1 ? "" : "s"} deleted.` });
  }

  async function handleAttachDocuments(application: JobApplication) {
    if (!isAttachmentMode || attachingApplicationId) return;
    const selectionError = getDocumentSelectionError(pendingAttachments);
    if (selectionError) {
      toast({ title: "Files not attached", description: selectionError, variant: "destructive" });
      return;
    }

    const result = buildApplicationDocumentAttachment(application, pendingAttachments, new Date().toISOString(), generateId);
    if (result.status === "conflict") {
      toast({
        title: "Existing attachment kept",
        description: `${application.companyName} — ${application.jobTitle} already uses ${result.existingName} for ${result.field}. Choose another application or remove the existing link first.`,
        variant: "destructive",
      });
      return;
    }
    if (result.status === "unchanged") {
      toast({ title: "Files already attached", description: `The selected files are already linked to ${application.companyName} — ${application.jobTitle}.` });
      onAttachmentsComplete?.();
      return;
    }

    setAttachingApplicationId(application.id);
    try {
      await onUpdate(result.application);
      toast({ title: "Files attached", description: `${pendingAttachments.length} file${pendingAttachments.length === 1 ? "" : "s"} linked to ${application.companyName} — ${application.jobTitle}.` });
      onAttachmentsComplete?.();
    } catch {
      toast({ title: "Files not attached", description: "The application update failed. Your files remain safe in Documents; please retry.", variant: "destructive" });
    } finally {
      setAttachingApplicationId(null);
    }
  }

  async function moveApplication(application: JobApplication, responseStatus: string, offerUndo = true) {
    // A per-record guard prevents rapid edits from saving stale status history out of order.
    if (readOnly || isAttachmentMode || pendingStatusIds.current.has(application.id)) return;
    const latest = applications.find((item) => item.id === application.id);
    // A lingering undo toast must never recreate a record deleted after the status change.
    if (!latest) return;
    const previousStatus = currentResponseStatus(latest);
    if (previousStatus === responseStatus) return;
    const updated = buildResponseStatusChangeApplication(latest, responseStatus, generateId(), new Date().toISOString());
    pendingStatusIds.current.add(application.id);
    setSavingStatusIds(new Set(pendingStatusIds.current));
    // The list and board share immediate feedback, failure rollback, and structured status history.
    setOptimisticStatuses((current) => ({ ...current, [application.id]: responseStatus }));
    try {
      const persisted = await onUpdate(updated);
      setSelectedApplication((current) => current?.id === persisted.id ? persisted : current);
      toast({
        title: `${application.companyName} moved to ${responseStatus}.`,
        description: "The status was saved.",
        action: offerUndo ? <ToastAction altText={`Undo move to ${responseStatus}`} onClick={() => void moveApplicationRef.current(updated, previousStatus, false)}>Undo</ToastAction> : undefined,
      });
    } catch {
      setOptimisticStatuses((current) => { const next = { ...current }; delete next[application.id]; return next; });
      toast({ title: "Move not saved", description: `${application.companyName} was restored to ${previousStatus}.`, variant: "destructive" });
    } finally {
      pendingStatusIds.current.delete(application.id);
      setSavingStatusIds(new Set(pendingStatusIds.current));
    }
  }

  function openDrawer(application: JobApplication) {
    setSelectedApplication(application);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Applications" description={isAttachmentMode ? "Choose the job that should use the selected files." : "Manage all your job applications in one place."} actions={<><Button variant="outline" size="sm" onClick={() => document.getElementById("job-tracker-import-input")?.click()}><Upload />Import</Button><Button size="sm" asChild><Link to="/app/add"><Plus />Add Application</Link></Button></>} />

      {isAttachmentMode && (
        <Alert className="border-primary/25 bg-primary/5">
          <Link2 className="h-4 w-4" />
          <AlertTitle>Choose an application</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{pendingAttachments.map((document) => document.name).join(" · ")}</span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onAttachmentsComplete?.()}>Cancel attachment</Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="app-panel flex flex-col gap-2 p-3 xl:flex-row xl:items-center" aria-label="Application filters">
        <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search applications" placeholder="Search company or job title" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-9 pl-9 text-xs" /></div>
        <Input aria-label="Company name" placeholder="Company" value={companyFilter} onChange={(event) => { setCompanyFilter(event.target.value); setPage(1); }} className="h-9 text-xs xl:w-40" />
        <select aria-label="Status" className="h-9 rounded-md border bg-background px-3 text-xs" value={activeStatus ?? "all"} onChange={(event) => setFilters(event.target.value === "all" ? {} : { status: event.target.value as CurrentStatus })}><option value="all">Any status</option>{CURRENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
        <select aria-label="Date filter" className="h-9 rounded-md border bg-background px-3 text-xs" value={dateFilterMode} onChange={(event) => setDateMode(event.target.value as DateFilterMode)}><option value="range">Date range</option><option value="date">Exact date</option><option value="month">Month</option><option value="year">Year</option></select>
        <Input aria-label={dateFilterMode === "range" ? "From date" : "Date value"} disabled={dateFilterMode === "any"} type={dateFilterMode === "range" || dateFilterMode === "date" ? "date" : dateFilterMode === "month" ? "month" : "number"} min={dateFilterMode === "year" ? "1900" : undefined} max={dateFilterMode === "year" ? "2100" : undefined} value={dateFilterValue} onChange={(event) => { setDateFilterValue(event.target.value); setPage(1); }} className="h-9 text-xs xl:w-36" />
        {dateFilterMode === "range" && <Input aria-label="To date" type="date" value={dateFilterEnd} onChange={(event) => { setDateFilterEnd(event.target.value); setPage(1); }} className="h-9 text-xs xl:w-36" />}
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Reset filters"><FilterX />Reset</Button>}
        {!isAttachmentMode && <div className="ml-auto flex rounded-md border p-0.5" aria-label="Application view"><Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" aria-label="List view" onClick={() => setViewMode("list")}><List /></Button><Button variant={viewMode === "board" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" aria-label="Board view" onClick={() => setViewMode("board")}><LayoutGrid /></Button></div>}
      </section>

      {!readOnly && !isAttachmentMode && selectedFilteredIds.length > 0 && <div className="flex flex-col gap-3 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold" aria-live="polite">{selectedFilteredIds.length} of {filtered.length} filtered applications selected</p><Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}><Trash2 />Delete selected</Button></div>}
      {/* The status dropdown is the single status-filter surface, so bulk selection can stay compact and unambiguous. */}
      {!readOnly && !isAttachmentMode && filtered.length > 0 && <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => toggleSelectAll(!allFilteredSelected)}>{allFilteredSelected ? "Clear selection" : "Select all"}</Button></div>}

      {isAttachmentMode || viewMode === "list" ? (
        <section className="app-panel overflow-hidden" aria-label="Applications list">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {!readOnly && !isAttachmentMode && <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>}
                  <TableHead>Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Follow-up</TableHead>
                  <TableHead><button type="button" className="flex items-center gap-1" onClick={() => setSortAsc((current) => !current)}>Date Applied <ArrowUpDown className="h-3 w-3" /></button></TableHead>
                  {!readOnly && isAttachmentMode && <TableHead className="w-28"><span className="sr-only">Attach</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedApplications.length === 0 ? (
                  <TableRow><TableCell colSpan={tableColumnCount} className="py-12 text-center text-sm text-muted-foreground">No applications found.</TableCell></TableRow>
                ) : pagedApplications.map((application) => (
                  <TableRow key={application.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDrawer(application)}>
                    {!readOnly && !isAttachmentMode && <TableCell onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${application.jobTitle} at ${application.companyName}`} checked={selectedIds.has(application.id)} onCheckedChange={(checked) => setSelectedIds((current) => { const next = new Set(current); if (checked === true) next.add(application.id); else next.delete(application.id); return next; })} /></TableCell>}
                    <TableCell className="min-w-48 font-semibold">{application.jobTitle}</TableCell>
                    <TableCell><span className="flex min-w-32 items-center gap-2"><CompanyLogo companyName={application.companyName} jobLink={application.jobLink} companyDomain={application.companyDomain} companyLogoUrl={application.companyLogoUrl} /><span className="truncate">{application.companyName}</span></span></TableCell>
                    <TableCell className="hidden md:table-cell">{application.location}</TableCell>
                    <TableCell className="whitespace-nowrap"><ResponseStatusSelect status={currentResponseStatus(application)} options={statusOptions} label={`Change status for ${application.jobTitle} at ${application.companyName}`} disabled={savingStatusIds.has(application.id)} readOnly={readOnly || isAttachmentMode} onChange={(status) => void moveApplication(application, status)} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{application.followUpDate ? formatDisplayDate(application.followUpDate) : application.followUps ? "Completed" : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDisplayDate(application.dateApplied)}</TableCell>
                    {!readOnly && isAttachmentMode && <TableCell onClick={(event) => event.stopPropagation()}><Button size="sm" disabled={Boolean(attachingApplicationId)} onClick={() => void handleAttachDocuments(application)}>{attachingApplicationId === application.id ? "Attaching..." : "Attach here"}</Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {filtered.length ? (Math.min(page, pageCount) - 1) * pageSize + 1 : 0}–{Math.min(Math.min(page, pageCount) * pageSize, filtered.length)} of {filtered.length}</span><div className="flex items-center gap-2"><label>Show <select aria-label="Results per page" value={pageSize} className="ml-1 h-8 rounded-md border bg-background px-2" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option>10</option><option>25</option><option>50</option></select></label><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span>{Math.min(page, pageCount)} / {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>
        </section>
      ) : (
        <section className="flex gap-3 overflow-x-auto pb-3" aria-label="Applications board">
          {boardColumns.map((column) => {
            const columnApplications = filtered.filter((application) => currentResponseStatus(application) === column);
            return <div key={column} role="group" aria-label={`${column} column`} className={cn("min-h-[420px] w-72 shrink-0 rounded-md border bg-muted/25 transition-colors", dropTarget === column && "border-primary bg-primary/5 ring-2 ring-primary/20")} onDragOver={(event) => { event.preventDefault(); setDropTarget(column); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => { event.preventDefault(); const application = applications.find((item) => item.id === draggedId); setDraggedId(null); setDropTarget(null); if (application) void moveApplication(application, column); }}><div className="flex items-center justify-between border-b px-3 py-2.5"><span className="text-xs font-bold">{column}</span><span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{columnApplications.length}</span></div><div className="space-y-2 p-2">{columnApplications.map((application) => <article key={application.id} aria-label={`${application.jobTitle} application card`} draggable={!readOnly && !savingStatusIds.has(application.id)} onDragStart={() => setDraggedId(application.id)} onDragEnd={() => { setDraggedId(null); setDropTarget(null); }} className={cn("app-panel cursor-pointer p-3 transition-all", draggedId === application.id && "scale-[1.02] opacity-60 shadow-lg")} onClick={() => openDrawer(application)}><div className="flex items-start gap-2"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{/* Board cards use the same logo service as the table so branding stays consistent. */}<CompanyLogo companyName={application.companyName} jobLink={application.jobLink} companyDomain={application.companyDomain} companyLogoUrl={application.companyLogoUrl} /><div className="min-w-0 flex-1"><h3 className="text-xs font-bold leading-5">{application.jobTitle}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">{application.companyName}</p></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Change status for ${application.jobTitle}`} onClick={(event) => event.stopPropagation()}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{boardColumns.map((status) => <DropdownMenuItem key={status} disabled={readOnly || savingStatusIds.has(application.id) || column === status} onClick={(event) => { event.stopPropagation(); void moveApplication(application, status); }}>{status}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div><div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span className="truncate">{application.location}</span><span className="shrink-0">{formatDisplayDate(application.dateApplied)}</span></div>{application.followUpDate && <p className="mt-2 flex items-center gap-1 text-[10px] text-amber-600"><CalendarDays className="h-3 w-3" />Follow up {formatDisplayDate(application.followUpDate)}</p>}{application.tags && <div className="mt-2 flex flex-wrap gap-1">{application.tags.split(",").slice(0, 3).map((tag) => <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{tag.trim()}</span>)}</div>}</article>)}</div></div>;
          })}
        </section>
      )}

      <Sheet open={Boolean(selectedApplication)} onOpenChange={(open) => { if (!open) setSelectedApplication(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedApplication && <><SheetHeader className="border-b pb-4 pr-8"><SheetTitle>{selectedApplication.jobTitle}</SheetTitle><SheetDescription>{selectedApplication.companyName} · {selectedApplication.location}</SheetDescription></SheetHeader><div className="space-y-5 py-5"><div className="flex flex-wrap items-center gap-2"><ResponseStatusSelect status={currentResponseStatus(selectedApplication)} options={statusOptions} label={`Change status for ${selectedApplication.jobTitle} at ${selectedApplication.companyName}`} disabled={savingStatusIds.has(selectedApplication.id)} readOnly={readOnly || isAttachmentMode} onChange={(status) => void moveApplication(selectedApplication, status)} /><span className="text-xs text-muted-foreground">Applied {formatDisplayDate(selectedApplication.dateApplied)}</span></div><dl className="grid gap-3 rounded-md border p-4 text-xs sm:grid-cols-2">{[
            ["Location", selectedApplication.location], ["Country", selectedApplication.country || "—"], ["Salary", selectedApplication.salary || "—"], ["Follow-up", selectedApplication.followUpDate ? formatDisplayDate(selectedApplication.followUpDate) : "Not scheduled"], ["Recruiter", selectedApplication.recruiterContactName || "—"], ["Tags", selectedApplication.tags || "—"],
          ].map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>{selectedJobPostingHref && <a href={selectedJobPostingHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Open job posting <ExternalLink className="h-3.5 w-3.5" /></a>}<section><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Notes</h3><p className="rounded-md border bg-muted/20 p-3 text-sm leading-6">{selectedApplication.notes || "No notes added."}</p></section><section><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Activity history</h3><div className="space-y-2">{selectedApplication.activityLog?.length ? selectedApplication.activityLog.map((entry) => <div key={entry.id} className="flex gap-3 rounded-md border p-3"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" /><div><p className="text-xs font-medium">{entry.message}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleString()}</p></div></div>) : <p className="text-xs text-muted-foreground">No activity recorded.</p>}</div></section><section><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Additional fields</h3><dl className="space-y-2">{Object.entries(selectedApplication.customFields || {}).map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b pb-2 text-xs"><dt className="text-muted-foreground">{key}</dt><dd className="text-right font-medium">{value || "—"}</dd></div>)}</dl></section></div><SheetFooter>{isAttachmentMode ? <Button disabled={Boolean(attachingApplicationId)} onClick={() => void handleAttachDocuments(selectedApplication)}>{attachingApplicationId === selectedApplication.id ? "Attaching..." : "Attach files to this application"}</Button> : <><Button variant="outline" onClick={() => { setSelectedApplication(null); onSelect(selectedApplication); }}>Open full record</Button><Button asChild><Link to={`/app/applications/${selectedApplication.id}`}>Edit application</Link></Button></>}</SheetFooter></>}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!isDeleting) setDeleteDialogOpen(open); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selectedFilteredIds.length} selected application{selectedFilteredIds.length === 1 ? "" : "s"}?</AlertDialogTitle><AlertDialogDescription>This permanently removes only the selected applications in the current filtered results. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting || !selectedFilteredIds.length} onClick={(event) => { event.preventDefault(); void handleBulkDelete(); }}>{isDeleting ? "Deleting..." : "Delete permanently"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
