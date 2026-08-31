import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, isAfter, isValid, parseISO } from "date-fns";
import { CalendarClock, Check, Mail, MoreHorizontal, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { isFollowUpIgnored } from "@/lib/overdue";
import { generateId } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";
import { formatDisplayDate } from "@/lib/utils";
import { CompanyLogo } from "@/components/CompanyLogo";

type FollowUpTab = "all" | "upcoming" | "overdue" | "completed" | "ignored";

function emailTemplate(application: JobApplication) {
  return `Subject: Following up – ${application.jobTitle} application\n\nDear Hiring Team,\n\nI recently applied for the ${application.jobTitle} position at ${application.companyName} on ${formatDisplayDate(application.dateApplied)} and wanted to reiterate my interest. Please let me know if I can provide any additional information.\n\nThank you for your time and consideration.\n\nBest regards`;
}

export default function FollowUps({ applications, onUpdate }: { applications: JobApplication[]; onUpdate?: (application: JobApplication) => Promise<JobApplication> }) {
  const [tab, setTab] = useState<FollowUpTab>("upcoming");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [rescheduling, setRescheduling] = useState<JobApplication | null>(null);
  const [nextDate, setNextDate] = useState("");
  const pendingIds = useRef(new Set<string>());
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const { toast } = useToast();
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => applications.map((application) => {
    const due = parseISO(application.followUpDate || "");
    const hasDueDate = isValid(due);
    const days = hasDueDate ? differenceInCalendarDays(due, now) : null;
    const completed = application.followUps;
    // Stale reminders leave the active queue without claiming a follow-up actually happened.
    const ignored = !completed && isFollowUpIgnored(application, now);
    const overdue = !completed && !ignored && hasDueDate && !isAfter(due, now);
    const derivedPriority = days !== null && days <= 2 ? "high" : days !== null && days <= 7 ? "medium" : "low";
    return { application, due, hasDueDate, days, completed, ignored, overdue, priority: derivedPriority };
  }).filter((row) => row.hasDueDate || row.completed), [applications, now]);

  const visible = rows.filter((row) => {
    if (tab === "ignored" && !row.ignored) return false;
    if (tab === "completed" && !row.completed) return false;
    if (tab === "overdue" && !row.overdue) return false;
    if (tab === "upcoming" && (row.completed || row.overdue || row.ignored)) return false;
    if (priority !== "all" && row.priority !== priority) return false;
    const query = search.trim().toLowerCase();
    return !query || `${row.application.companyName} ${row.application.jobTitle}`.toLowerCase().includes(query);
  });

  async function save(application: JobApplication, changes: Partial<JobApplication>, message: string) {
    if (!onUpdate || pendingIds.current.has(application.id)) return false;
    pendingIds.current.add(application.id);
    setSavingIds(new Set(pendingIds.current));
    // Completing clears the active schedule; the activity entry preserves the completion history.
    const updated: JobApplication = {
      ...application,
      ...changes,
      activityLog: [{ id: generateId(), date: new Date().toISOString(), type: "follow_up", message }, ...(application.activityLog || [])],
    };
    try { await onUpdate(updated); toast({ title: "Follow-up updated", description: message }); return true; }
    catch { toast({ title: "Update not saved", description: "The existing follow-up was kept. Please retry.", variant: "destructive" }); return false; }
    finally { pendingIds.current.delete(application.id); setSavingIds(new Set(pendingIds.current)); }
  }

  async function reschedule() {
    if (!rescheduling) return;
    const date = nextDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValid(parseISO(date))) {
      toast({ title: "Invalid date", description: "Enter a valid date as YYYY-MM-DD.", variant: "destructive" });
      return;
    }
    const current = applications.find((application) => application.id === rescheduling.id);
    if (!current) return;
    const saved = await save(current, { followUpDate: date, followUps: false }, `Rescheduled follow-up with ${current.companyName} to ${date}`);
    if (saved) setRescheduling(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Follow-ups" description="Follow-ups more than 30 days past due are automatically ignored. Reschedule one to bring it back." />
      <div className="flex flex-col gap-3 border-b lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Follow-up status">
          {(["all", "upcoming", "overdue", "completed", "ignored"] as FollowUpTab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold capitalize ${tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item}</button>)}
        </div>
        <div className="flex gap-2 pb-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search follow-ups" placeholder="Search follow-ups" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-9 text-xs" /></div><select aria-label="Priority" className="h-9 rounded-md border bg-background px-3 text-xs" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
      </div>

      <section className="app-panel overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-[1.3fr_0.75fr_0.55fr_0.6fr_auto] gap-3 border-b bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><span>Application</span><span>Due Date</span><span>Status</span><span>Priority</span><span className="w-10" /></div>
        {visible.length === 0 ? <div className="flex flex-col items-center py-14 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarClock /></span><p className="text-sm font-semibold">No follow-ups in this view</p><p className="mt-1 text-xs text-muted-foreground">Try another tab or adjust your filters.</p></div> : visible.map((row) => <div key={row.application.id} className="grid min-w-[560px] grid-cols-[1.3fr_0.75fr_0.55fr_0.6fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"><div className="flex min-w-0 items-center gap-2">{/* Shared company logo service keeps follow-up rows visually aligned with the applications table. */}<CompanyLogo companyName={row.application.companyName} jobLink={row.application.jobLink} companyDomain={row.application.companyDomain} companyLogoUrl={row.application.companyLogoUrl} /><div className="min-w-0"><p className="truncate text-xs font-bold">{row.application.companyName}</p><p className="truncate text-[10px] text-muted-foreground">{row.application.jobTitle}</p></div></div><span className="whitespace-nowrap text-[11px]">{formatDisplayDate(row.application.followUpDate)}</span><span className={`whitespace-nowrap text-[11px] font-semibold ${row.ignored ? "text-muted-foreground" : row.overdue ? "text-destructive" : row.completed ? "text-emerald-600" : "text-amber-600"}`}>{row.ignored ? "Ignored" : row.completed ? "Done" : row.days === 0 ? "Today" : row.days !== null && row.days > 0 ? `${row.days} days` : `${Math.abs(row.days || 0)} late`}</span><span className={`w-fit rounded px-2 py-1 text-[9px] font-bold capitalize ${row.ignored || row.completed ? "text-muted-foreground" : row.priority === "high" ? "bg-red-50 text-red-700 dark:bg-red-950/50" : row.priority === "medium" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50"}`}>{row.ignored || row.completed ? "—" : row.priority}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" disabled={savingIds.has(row.application.id)} aria-label={`Actions for ${row.application.companyName}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{!row.completed && <DropdownMenuItem disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => void save(row.application, { followUps: true, followUpDate: "" }, `Completed follow-up with ${row.application.companyName}`)}><Check className="mr-2 h-4 w-4" />Mark complete</DropdownMenuItem>}<DropdownMenuItem disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => { setNextDate(row.application.followUpDate); setRescheduling(row.application); }}><CalendarClock className="mr-2 h-4 w-4" />Reschedule</DropdownMenuItem><DropdownMenuItem onClick={async () => { await navigator.clipboard.writeText(emailTemplate(row.application)); toast({ title: "Message copied", description: "The email follow-up is ready to paste." }); }}><Mail className="mr-2 h-4 w-4" />Copy email</DropdownMenuItem><DropdownMenuItem asChild><Link to={`/app/applications/${row.application.id}`}>Open application</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}
      </section>
      {/* An in-page dialog works in embedded browsers and retains the date after a failed save. */}
      <Dialog open={Boolean(rescheduling)} onOpenChange={(open) => { if (!open && !savingIds.has(rescheduling?.id ?? "")) setRescheduling(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule follow-up</DialogTitle><DialogDescription>Choose a new date for {rescheduling?.companyName}. A date today or in the future brings an ignored reminder back into the active queue.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void reschedule(); }} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="next-follow-up-date" className="text-sm font-medium">New follow-up date</label>
              <Input id="next-follow-up-date" placeholder="YYYY-MM-DD" aria-describedby="next-follow-up-date-format" value={nextDate} disabled={savingIds.has(rescheduling?.id ?? "")} onChange={(event) => setNextDate(event.target.value)} />
              <p id="next-follow-up-date-format" className="text-xs text-muted-foreground">Use YYYY-MM-DD, for example 2026-09-15.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={savingIds.has(rescheduling?.id ?? "")} onClick={() => setRescheduling(null)}>Cancel</Button>
              <Button type="submit" disabled={!onUpdate || savingIds.has(rescheduling?.id ?? "")}>{savingIds.has(rescheduling?.id ?? "") ? "Saving..." : "Save date"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
