import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, ArrowUpDown } from "lucide-react";
import type { JobApplication, CurrentStatus } from "@/lib/types";
import { CURRENT_STATUSES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ApplicationsList({ applications, onSelect }: { applications: JobApplication[]; onSelect: (app: JobApplication) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const activeStatus = searchParams.get("status") as CurrentStatus | null;

  const filtered = useMemo(() => {
    let list = applications;
    if (activeStatus) list = list.filter((a) => a.currentStatus === activeStatus);
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
  }, [applications, activeStatus, search, sortAsc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={!activeStatus ? "default" : "outline"} className="cursor-pointer" onClick={() => setSearchParams({})}>
          All ({applications.length})
        </Badge>
        {CURRENT_STATUSES.map((s) => {
          const count = applications.filter((a) => a.currentStatus === s).length;
          if (count === 0) return null;
          return (
            <Badge key={s} variant={activeStatus === s ? "default" : "outline"} className="cursor-pointer" onClick={() => setSearchParams({ status: s })}>
              {s} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Title</TableHead>
              <TableHead className="hidden sm:table-cell">Company</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => setSortAsc(!sortAsc)}>
                <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No applications found</TableCell></TableRow>
            ) : filtered.map((a) => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => onSelect(a)}>
                <TableCell className="font-medium">{a.jobTitle}</TableCell>
                <TableCell className="hidden sm:table-cell">{a.companyName}</TableCell>
                <TableCell className="hidden md:table-cell">{a.location}</TableCell>
                <TableCell><StatusBadge status={a.currentStatus} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.dateApplied}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {applications.length} applications</p>
    </div>
  );
}
