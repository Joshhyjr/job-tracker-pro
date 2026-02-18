import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, ArrowUpDown, MoreHorizontal } from "lucide-react";
import type { JobApplication, CurrentStatus, ActivityLogEntry } from "@/lib/types";
import { CURRENT_STATUSES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn, formatDisplayDate } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getPreferredResponseStatusOrder, updateApplication, generateId } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { computeStatusBreakdown, getEffectiveCurrentStatus, getResponseStatusBadgeClass, mapCurrentStatusToResponseStatus, normalizeResponseStatus } from "@/lib/responseStatus";

export default function ApplicationsList({ applications, onSelect, onUpdate }: { applications: JobApplication[]; onSelect: (app: JobApplication) => void; onUpdate: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const activeStatus = searchParams.get("status") as CurrentStatus | null;
  const activeResponseStatus = searchParams.get("responseStatus");
  const { toast } = useToast();

  // Dynamic response-status breakdown from current dataset
  const responseBreakdown = useMemo(
    () => computeStatusBreakdown(applications, getPreferredResponseStatusOrder()),
    [applications]
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
    list = [...list].sort((a, b) => {
      const da = a.dateApplied || "", db = b.dateApplied || "";
      return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
    });
    return list;
  }, [applications, activeResponseStatus, activeStatus, search, sortAsc]);

  function handleChangeStatus(app: JobApplication, status: CurrentStatus) {
    const entry: ActivityLogEntry = { id: generateId(), date: new Date().toISOString(), type: "status_change", message: `Status changed to ${status}` };
    const mappedResponseStatus = mapCurrentStatusToResponseStatus(status);
    const updatedApp: JobApplication = {
      ...app,
      currentStatus: status,
      responseStatus: mappedResponseStatus ?? app.responseStatus,
      activityLog: [entry, ...(app.activityLog || [])],
    };
    updateApplication(updatedApp);
    onUpdate();
    toast({ title: "Status Updated", description: `Marked as ${status}` });
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

      {/* Filter chips — glass toolbar */}
      <div className="glass-subtle rounded-2xl px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={!activeStatus && !activeResponseStatus ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSearchParams({})}
          >
            All ({applications.length})
          </Badge>
          {CURRENT_STATUSES.map((s) => {
            const count = applications.filter((a) => getEffectiveCurrentStatus(a) === s).length;
            if (count === 0) return null;
            return (
              <Badge key={s} variant={activeStatus === s ? "default" : "outline"} className="cursor-pointer" onClick={() => setSearchParams({ status: s })}>
                {s} ({count})
              </Badge>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {responseBreakdown.map((item) => (
            <Badge
              key={item.key}
              variant="outline"
              className={cn("cursor-pointer", getResponseStatusBadgeClass(item.key, activeResponseStatus === item.key))}
              onClick={() => setSearchParams({ ...(activeStatus ? { status: activeStatus } : {}), responseStatus: item.key })}
            >
              {item.label} ({item.count})
            </Badge>
          ))}
        </div>
      </div>

      {/* Table — minimal borders */}
      <div className="rounded-2xl border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead>Job Title</TableHead>
              <TableHead className="hidden sm:table-cell">Company</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => setSortAsc(!sortAsc)}>
                <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No applications found</TableCell></TableRow>
            ) : filtered.map((a) => (
              <TableRow key={a.id} className="cursor-pointer border-border/30 hover:bg-muted/40" onClick={() => onSelect(a)}>
                <TableCell className="font-medium">{a.jobTitle}</TableCell>
                <TableCell className="hidden sm:table-cell">{a.companyName}</TableCell>
                <TableCell className="hidden md:table-cell">{a.location}</TableCell>
                <TableCell><StatusBadge status={getEffectiveCurrentStatus(a)} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDisplayDate(a.dateApplied)}</TableCell>
                <TableCell className="text-right">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {applications.length} applications</p>
    </div>
  );
}
