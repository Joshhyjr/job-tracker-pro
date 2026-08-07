import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, isAfter, isValid, parseISO } from "date-fns";
import { CalendarClock, Check, Mail, MoreHorizontal, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";
import { formatDisplayDate } from "@/lib/utils";
import { CompanyLogo } from "@/components/CompanyLogo";

type FollowUpTab = "all" | "upcoming" | "overdue" | "completed";

function emailTemplate(application: JobApplication) {
  return `Subject: Following up – ${application.jobTitle} application\n\nDear Hiring Team,\n\nI recently applied for the ${application.jobTitle} position at ${application.companyName} on ${formatDisplayDate(application.dateApplied)} and wanted to reiterate my interest. Please let me know if I can provide any additional information.\n\nThank you for your time and consideration.\n\nBest regards`;
}

export default function FollowUps({ applications, onUpdate }: { applications: JobApplication[]; onUpdate?: (application: JobApplication) => Promise<JobApplication> }) {
  const [tab, setTab] = useState<FollowUpTab>("upcoming");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const { toast } = useToast();
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => applications.map((application) => {
    const due = parseISO(application.followUpDate || "");
    const hasDueDate = isValid(due);
    const days = hasDueDate ? differenceInCalendarDays(due, now) : null;
    const completed = application.followUps;
    const overdue = !completed && hasDueDate && !isAfter(due, now);
    const derivedPriority = days !== null && days <= 2 ? "high" : days !== null && days <= 7 ? "medium" : "low";
    return { application, due, hasDueDate, days, completed, overdue, priority: derivedPriority };
  }).filter((row) => row.hasDueDate || row.completed), [applications, now]);

  const visible = rows.filter((row) => {
    if (tab === "completed" && !row.completed) return false;
    if (tab === "overdue" && !row.overdue) return false;
    if (tab === "upcoming" && (row.completed || row.overdue)) return false;
    if (priority !== "all" && row.priority !== priority) return false;
    const query = search.trim().toLowerCase();
    return !query || `${row.application.companyName} ${row.application.jobTitle}`.toLowerCase().includes(query);
  });

  async function save(application: JobApplication, changes: Partial<JobApplication>, message: string) {
    if (!onUpdate) return;
    const updated: JobApplication = {
      ...application,
      ...changes,
      activityLog: [{ id: generateId(), date: new Date().toISOString(), type: "follow_up", message }, ...(application.activityLog || [])],
    };
    try { await onUpdate(updated); toast({ title: "Follow-up updated", description: message }); }
    catch { toast({ title: "Update not saved", description: "The existing follow-up was kept. Please retry.", variant: "destructive" }); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Follow-ups" description="Never miss a follow-up again." />
      <div className="flex flex-col gap-3 border-b lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Follow-up status">
          {(["all", "upcoming", "overdue", "completed"] as FollowUpTab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold capitalize ${tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item}</button>)}
        </div>
        <div className="flex gap-2 pb-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search follow-ups" placeholder="Search follow-ups" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-9 text-xs" /></div><select aria-label="Priority" className="h-9 rounded-md border bg-background px-3 text-xs" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
      </div>

      <section className="app-panel overflow-hidden">
        <div className="grid grid-cols-[1.3fr_0.75fr_0.55fr_0.6fr_auto] gap-3 border-b bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><span>Application</span><span>Due Date</span><span>In</span><span>Priority</span><span className="w-10" /></div>
        {visible.length === 0 ? <div className="flex flex-col items-center py-14 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarClock /></span><p className="text-sm font-semibold">No follow-ups in this view</p><p className="mt-1 text-xs text-muted-foreground">Try another tab or adjust your filters.</p></div> : visible.map((row) => <div key={row.application.id} className="grid grid-cols-[1.3fr_0.75fr_0.55fr_0.6fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"><div className="flex min-w-0 items-center gap-2">{/* Shared company logo service keeps follow-up rows visually aligned with the applications table. */}<CompanyLogo companyName={row.application.companyName} jobLink={row.application.jobLink} companyDomain={row.application.companyDomain} companyLogoUrl={row.application.companyLogoUrl} /><div className="min-w-0"><p className="truncate text-xs font-bold">{row.application.companyName}</p><p className="truncate text-[10px] text-muted-foreground">{row.application.jobTitle}</p></div></div><span className="whitespace-nowrap text-[11px]">{formatDisplayDate(row.application.followUpDate)}</span><span className={`whitespace-nowrap text-[11px] font-semibold ${row.overdue ? "text-destructive" : row.completed ? "text-emerald-600" : "text-amber-600"}`}>{row.completed ? "Done" : row.days === 0 ? "Today" : row.days !== null && row.days > 0 ? `${row.days} days` : `${Math.abs(row.days || 0)} late`}</span><span className={`w-fit rounded px-2 py-1 text-[9px] font-bold capitalize ${row.priority === "high" ? "bg-red-50 text-red-700 dark:bg-red-950/50" : row.priority === "medium" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50"}`}>{row.priority}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${row.application.companyName}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{!row.completed && <DropdownMenuItem onClick={() => void save(row.application, { followUps: true }, `Completed follow-up with ${row.application.companyName}`)}><Check className="mr-2 h-4 w-4" />Mark complete</DropdownMenuItem>}<DropdownMenuItem onClick={() => { const next = window.prompt("New follow-up date (YYYY-MM-DD)", row.application.followUpDate)?.trim(); if (next) void save(row.application, { followUpDate: next, followUps: false }, `Rescheduled follow-up with ${row.application.companyName}`); }}><CalendarClock className="mr-2 h-4 w-4" />Reschedule</DropdownMenuItem><DropdownMenuItem onClick={async () => { await navigator.clipboard.writeText(emailTemplate(row.application)); toast({ title: "Message copied", description: "The email follow-up is ready to paste." }); }}><Mail className="mr-2 h-4 w-4" />Copy email</DropdownMenuItem><DropdownMenuItem asChild><Link to={`/app/applications/${row.application.id}`}>Open application</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}
      </section>
    </div>
  );
}
