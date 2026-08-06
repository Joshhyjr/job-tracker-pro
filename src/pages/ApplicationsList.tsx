import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, ArrowUpDown, MoreHorizontal, Trash2 } from "lucide-react";
import type { JobApplication, CurrentStatus } from "@/lib/types";
import { CURRENT_STATUSES } from "@/lib/types";
import { badgeVariants } from "@/components/ui/badge";
import { cn, formatDisplayDate } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getPreferredResponseStatusOrder, generateId } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { buildStatusChangeApplication, computeStatusBreakdown, getEffectiveCurrentStatus, getResponseStatusBadgeClass, normalizeResponseStatus } from "@/lib/responseStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DateFilterMode = "any" | "date" | "range" | "month" | "year";

interface ApplicationsListProps {
  applications: JobApplication[];
  onSelect: (app: JobApplication) => void;
  onUpdate: (application: JobApplication) => Promise<JobApplication>;
  onDelete: (id: string) => Promise<void>;
  isDemo?: boolean;
  readOnly?: boolean;
}

export default function ApplicationsList({ applications, onSelect, onUpdate, onDelete, isDemo = false, readOnly = false }: ApplicationsListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("any");
  const [dateFilterValue, setDateFilterValue] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const activeStatus = searchParams.get("status") as CurrentStatus | null;
  const activeResponseStatus = searchParams.get("responseStatus");
  const { toast } = useToast();

  // Centralize filter param updates so the filter controls stay declarative.
  function setFilters(next: { status?: CurrentStatus; responseStatus?: string }) {
    const nextParams = new URLSearchParams();
    if (next.status) nextParams.set("status", next.status);
    if (next.responseStatus) nextParams.set("responseStatus", next.responseStatus);
    setSearchParams(nextParams);
  }

  // Dynamic response-status breakdown from current dataset
  const responseBreakdown = useMemo(
    // Demo pages must not read the owner's browser-only workbook preferences after sign-out.
    () => computeStatusBreakdown(applications, isDemo ? [] : getPreferredResponseStatusOrder()),
    [applications, isDemo]
  );

  // Filter + sort the applications list
  const filtered = useMemo(() => {
    let list = applications;
    if (activeStatus) list = list.filter((a) => getEffectiveCurrentStatus(a) === activeStatus);
    if (activeResponseStatus) {
      list = list.filter((a) => normalizeResponseStatus(a.responseStatus) === activeResponseStatus);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        [a.jobTitle, a.companyName, a.location, a.notes].some((f) => f.toLowerCase().includes(q))
      );
    }
    if (companyFilter.trim()) {
      const companyQuery = companyFilter.trim().toLowerCase();
      // Company filtering is deliberately partial and case-insensitive for long or inconsistent workbook names.
      list = list.filter((application) => application.companyName.toLowerCase().includes(companyQuery));
    }
    if (dateFilterMode === "range" && (dateFilterValue || dateFilterEnd)) {
      // ISO calendar strings can be compared directly, keeping both entered boundaries inclusive.
      list = list.filter((application) => {
        const appliedDate = application.dateApplied;
        if (!appliedDate) return false;
        if (dateFilterValue && appliedDate < dateFilterValue) return false;
        if (dateFilterEnd && appliedDate > dateFilterEnd) return false;
        return true;
      });
    } else if (dateFilterMode !== "any" && dateFilterValue) {
      // Persisted application dates are YYYY-MM-DD strings, so prefix matching avoids timezone shifts.
      list = list.filter((application) => {
        if (dateFilterMode === "year") return application.dateApplied.startsWith(dateFilterValue);
        if (dateFilterMode === "month") return application.dateApplied.startsWith(`${dateFilterValue}-`);
        return application.dateApplied === dateFilterValue;
      });
    }
    list = [...list].sort((a, b) => {
      const da = a.dateApplied || "", db = b.dateApplied || "";
      return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
    });
    return list;
  }, [applications, activeResponseStatus, activeStatus, companyFilter, dateFilterEnd, dateFilterMode, dateFilterValue, search, sortAsc]);

  const filteredIds = useMemo(() => filtered.map((application) => application.id), [filtered]);
  const selectedFilteredIds = useMemo(
    // Bulk actions are scoped to visible results so a hidden record cannot be deleted accidentally.
    () => filteredIds.filter((id) => selectedIds.has(id)),
    [filteredIds, selectedIds],
  );
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;
  const someFilteredSelected = selectedFilteredIds.length > 0 && !allFilteredSelected;
  const hasActiveFilters = Boolean(search || companyFilter.trim() || dateFilterMode !== "any" || activeStatus || activeResponseStatus);

  function setDateMode(mode: DateFilterMode) {
    // Reset incompatible input values when switching between date filter controls.
    setDateFilterMode(mode);
    setDateFilterValue("");
    setDateFilterEnd("");
  }

  function clearFilters() {
    setSearch("");
    setCompanyFilter("");
    setDateFilterMode("any");
    setDateFilterValue("");
    setDateFilterEnd("");
    setFilters({});
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      // Select All follows the current filters instead of reaching into hidden rows.
      filteredIds.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (isDeleting || selectedFilteredIds.length === 0) return;
    const idsToDelete = [...selectedFilteredIds];
    const deletedIds: string[] = [];
    let failureCount = 0;
    setIsDeleting(true);

    // Sequential writes keep the shared synchronization state accurate and make partial failures countable.
    for (const id of idsToDelete) {
      try {
        await onDelete(id);
        deletedIds.push(id);
      } catch {
        failureCount += 1;
      }
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setIsDeleting(false);
    setDeleteDialogOpen(false);

    if (failureCount > 0) {
      toast({
        title: "Some applications were not deleted",
        description: `${deletedIds.length} deleted, ${failureCount} failed. The failed applications remain selected so you can retry.`,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Applications deleted", description: `${deletedIds.length} application${deletedIds.length === 1 ? "" : "s"} deleted.` });
  }

  async function handleChangeStatus(app: JobApplication, status: CurrentStatus) {
    // Share the exact same transition logic as the detail view to avoid duplicate status-sync code.
    const updatedApp = buildStatusChangeApplication(app, status, generateId(), new Date().toISOString());
    try {
      await onUpdate(updatedApp);
      toast({ title: "Status Updated", description: `Marked as ${status}` });
    } catch {
      // Keep cloud failures actionable instead of claiming the remote status was updated.
      toast({ title: "Sync failed", description: "The status was not saved. Please retry.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Dedicated fields make company and calendar filters discoverable beyond the broad search box. */}
      <div className={cn("glass-subtle grid gap-3 rounded-2xl px-4 py-4 sm:grid-cols-2", dateFilterMode === "range" ? "lg:grid-cols-5" : "lg:grid-cols-4")} aria-label="Application filters">
        <label className="space-y-1.5 text-sm font-medium">
          <span>Company name</span>
          <Input aria-label="Company name" placeholder="Any company" value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Status</span>
          <select
            aria-label="Status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={activeStatus ?? "all"}
            onChange={(event) => setFilters(event.target.value === "all" ? {} : { status: event.target.value as CurrentStatus })}
          >
            <option value="all">Any status</option>
            {CURRENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Date filter</span>
          <select
            aria-label="Date filter"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={dateFilterMode}
            onChange={(event) => setDateMode(event.target.value as DateFilterMode)}
          >
            <option value="any">Any date</option>
            <option value="date">Exact date</option>
            <option value="range">Date range</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>{dateFilterMode === "range" ? "From date" : dateFilterMode === "date" ? "Date" : dateFilterMode === "month" ? "Month" : dateFilterMode === "year" ? "Year" : "Date value"}</span>
          <Input
            aria-label={dateFilterMode === "range" ? "From date" : "Date value"}
            disabled={dateFilterMode === "any"}
            type={dateFilterMode === "date" || dateFilterMode === "range" ? "date" : dateFilterMode === "month" ? "month" : dateFilterMode === "year" ? "number" : "text"}
            min={dateFilterMode === "year" ? "1900" : undefined}
            max={dateFilterMode === "year" ? "2100" : undefined}
            placeholder={dateFilterMode === "year" ? "YYYY" : "Choose a filter first"}
            value={dateFilterValue}
            onChange={(event) => setDateFilterValue(event.target.value)}
          />
        </label>
        {dateFilterMode === "range" && (
          <label className="space-y-1.5 text-sm font-medium">
            <span>To date</span>
            <Input
              aria-label="To date"
              type="date"
              value={dateFilterEnd}
              onChange={(event) => setDateFilterEnd(event.target.value)}
            />
          </label>
        )}
        {hasActiveFilters && (
          <div className={cn("sm:col-span-2", dateFilterMode === "range" ? "lg:col-span-5" : "lg:col-span-4")}>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}
      </div>

      {/* Filter chips — glass toolbar */}
      <div className="glass-subtle rounded-2xl px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={!activeStatus && !activeResponseStatus ? "default" : "outline"}
            size="sm"
            onClick={() => setFilters({})}
          >
            All ({applications.length})
          </Button>
          {CURRENT_STATUSES.map((s) => {
            const count = applications.filter((a) => getEffectiveCurrentStatus(a) === s).length;
            if (count === 0) return null;
            return (
              <Button key={s} type="button" variant={activeStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilters({ status: s })}>
                {s} ({count})
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {responseBreakdown.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn(
                badgeVariants({ variant: "outline" }),
                "rounded-full px-3 py-1",
                getResponseStatusBadgeClass(item.key, activeResponseStatus === item.key)
              )}
              onClick={() => setFilters({ ...(activeStatus ? { status: activeStatus } : {}), responseStatus: item.key })}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      {!readOnly && selectedFilteredIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium" aria-live="polite">{selectedFilteredIds.length} of {filtered.length} filtered applications selected</p>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete selected
          </Button>
        </div>
      )}

      {/* Table — minimal borders */}
      <div className="rounded-2xl border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              {!readOnly && (
                <TableHead className="w-12">
                  <Checkbox
                    aria-label="Select all filtered applications"
                    checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  />
                </TableHead>
              )}
              <TableHead>Job Title</TableHead>
              <TableHead className="hidden sm:table-cell">Company</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="select-none">
                <button
                  type="button"
                  className="flex items-center gap-1 text-left"
                  onClick={() => setSortAsc((current) => !current)}
                >
                  Date <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              {!readOnly && <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={readOnly ? 5 : 7} className="text-center text-muted-foreground py-8">No applications found</TableCell></TableRow>
            ) : filtered.map((a) => (
              <TableRow key={a.id} className="cursor-pointer border-border/30 hover:bg-muted/40" onClick={() => onSelect(a)}>
                {!readOnly && (
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${a.jobTitle} at ${a.companyName}`}
                      checked={selectedIds.has(a.id)}
                      onCheckedChange={(checked) => toggleSelection(a.id, checked === true)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">{a.jobTitle}</TableCell>
                <TableCell className="hidden sm:table-cell">{a.companyName}</TableCell>
                <TableCell className="hidden md:table-cell">{a.location}</TableCell>
                <TableCell><StatusBadge status={getEffectiveCurrentStatus(a)} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDisplayDate(a.dateApplied)}</TableCell>
                {!readOnly && <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {CURRENT_STATUSES.map((s) => (
                        <DropdownMenuItem key={s} onClick={() => handleChangeStatus(a, s)} disabled={getEffectiveCurrentStatus(a) === s}>{s}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {applications.length} applications</p>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          // Prevent dismissing the warning while cloud deletions are still in progress.
          if (!isDeleting) setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedFilteredIds.length} selected application{selectedFilteredIds.length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes only the selected applications in the current filtered results. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting || selectedFilteredIds.length === 0}
              onClick={(event) => {
                // Keep the dialog mounted so progress and failures remain attached to this confirmed selection.
                event.preventDefault();
                void handleBulkDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
