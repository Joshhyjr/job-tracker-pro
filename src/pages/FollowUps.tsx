import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, Check, Mail, MoreHorizontal, Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { ResponseStatusSelect } from "@/components/ResponseStatusSelect";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getScheduledFollowUpState, type ScheduledFollowUpState } from "@/lib/overdue";
import { buildResponseStatusChangeApplication, normalizeResponseStatus, normalizeResponseStatusList } from "@/lib/responseStatus";
import { generateId } from "@/lib/storage";
import { RESPONSE_STATUSES, type JobApplication } from "@/lib/types";
import { formatDisplayDate } from "@/lib/utils";
import { CompanyLogo } from "@/components/CompanyLogo";

type FollowUpTab = "all" | "upcoming" | "overdue" | "completed" | "ignored";

const FOLLOW_UP_TABS: FollowUpTab[] = ["overdue", "upcoming", "completed", "ignored", "all"];
const FOLLOW_UP_TAB_LABELS: Record<FollowUpTab, string> = {
  overdue: "Needs attention",
  upcoming: "Upcoming",
  completed: "Completed",
  ignored: "Ignored",
  all: "All",
};
const FOLLOW_UP_DISPLAY_ORDER = ["overdue", "upcoming", "completed", "ignored"] as const;
const FOLLOW_UP_STATE_ORDER: Record<Exclude<ScheduledFollowUpState, "hidden">, number> = {
  overdue: 0,
  upcoming: 1,
  completed: 2,
  ignored: 3,
};

function followUpStatusLabel(state: ScheduledFollowUpState, days: number | null): string {
  if (state === "completed") return "Completed";
  if (state === "ignored") return "Ignored";
  if (days === 0) return "Today";
  if (days !== null && days > 0) return `In ${days} ${days === 1 ? "day" : "days"}`;
  const overdueDays = Math.abs(days ?? 0);
  return `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`;
}

function emailTemplate(application: JobApplication) {
  return `Subject: Following up – ${application.jobTitle} application\n\nDear Hiring Team,\n\nI recently applied for the ${application.jobTitle} position at ${application.companyName} on ${formatDisplayDate(application.dateApplied)} and wanted to reiterate my interest. Please let me know if I can provide any additional information.\n\nThank you for your time and consideration.\n\nBest regards`;
}

export default function FollowUps({ applications, onUpdate }: { applications: JobApplication[]; onUpdate?: (application: JobApplication) => Promise<JobApplication> }) {
  const [tab, setTab] = useState<FollowUpTab>("overdue");
  const [search, setSearch] = useState("");
  const [rescheduling, setRescheduling] = useState<JobApplication | null>(null);
  const [nextDate, setNextDate] = useState("");
  const [confirmBulkReschedule, setConfirmBulkReschedule] = useState(false);
  const [bulkRescheduling, setBulkRescheduling] = useState(false);
  const pendingIds = useRef(new Set<string>());
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const { toast } = useToast();
  const now = useMemo(() => new Date(), []);
  const statusOptions = useMemo(() => normalizeResponseStatusList([
    ...RESPONSE_STATUSES,
    "Withdrawn",
    ...applications.map((application) => application.responseStatus),
  ]), [applications]);

  const rows = useMemo(() => applications.map((application, index) => {
    const due = parseISO(application.followUpDate || "");
    const hasDueDate = isValid(due);
    const days = hasDueDate ? differenceInCalendarDays(due, now) : null;
    const state = getScheduledFollowUpState(application, now);
    const normalizedResponseStatus = normalizeResponseStatus(application.responseStatus);
    // Imported rows may use Applied as a response fallback while preserving a more meaningful fixed current status.
    const applicationStatus = normalizedResponseStatus === "Applied" && application.currentStatus !== "Applied"
      ? application.currentStatus
      : normalizedResponseStatus;
    return { application, due, hasDueDate, days, state, applicationStatus, index };
  }).filter((row): row is typeof row & { state: Exclude<ScheduledFollowUpState, "hidden"> } => row.state !== "hidden").sort((left, right) => {
    const stateDifference = FOLLOW_UP_STATE_ORDER[left.state] - FOLLOW_UP_STATE_ORDER[right.state];
    if (stateDifference !== 0) return stateDifference;
    if (left.hasDueDate && right.hasDueDate) return left.due.getTime() - right.due.getTime();
    return left.index - right.index;
  }), [applications, now]);

  const tabCounts = useMemo(() => rows.reduce<Record<FollowUpTab, number>>((counts, row) => {
    // Counts reflect only rows available on this page; terminal pending reminders remain preserved but hidden.
    counts.all += 1;
    counts[row.state] += 1;
    return counts;
  }, { all: 0, upcoming: 0, overdue: 0, completed: 0, ignored: 0 }), [rows]);

  const visible = useMemo(() => rows.filter((row) => {
    if (tab !== "all" && row.state !== tab) return false;
    const query = search.trim().toLowerCase();
    return !query || `${row.application.companyName} ${row.application.jobTitle}`.toLowerCase().includes(query);
  }), [rows, search, tab]);
  const overdueRows = useMemo(() => rows.filter((row) => row.state === "overdue"), [rows]);

  async function save(application: JobApplication, changes: Partial<JobApplication>, message: string, showToast = true) {
    if (!onUpdate || pendingIds.current.has(application.id)) return false;
    pendingIds.current.add(application.id);
    setSavingIds(new Set(pendingIds.current));
    // Completing clears the active schedule; the activity entry preserves the completion history.
    const updated: JobApplication = {
      ...application,
      ...changes,
      activityLog: [{ id: generateId(), date: new Date().toISOString(), type: "follow_up", message }, ...(application.activityLog || [])],
    };
    try { await onUpdate(updated); if (showToast) toast({ title: "Follow-up updated", description: message }); return true; }
    catch { if (showToast) toast({ title: "Update not saved", description: "The existing follow-up was kept. Please retry.", variant: "destructive" }); return false; }
    finally { pendingIds.current.delete(application.id); setSavingIds(new Set(pendingIds.current)); }
  }

  async function snoozeOneWeek(application: JobApplication) {
    const dueDate = parseISO(application.followUpDate || "");
    if (!isValid(dueDate)) return;
    // Snoozing shifts the existing due date exactly seven calendar days and reopens the reminder.
    const nextFollowUpDate = format(addDays(dueDate, 7), "yyyy-MM-dd");
    await save(application, { followUpDate: nextFollowUpDate, followUps: false }, `Snoozed follow-up with ${application.companyName} until ${nextFollowUpDate}`);
  }

  async function rescheduleAllOverdue() {
    if (!onUpdate || bulkRescheduling || overdueRows.length === 0) return;
    setBulkRescheduling(true);
    try {
      // Reuse the guarded row save so every reschedule keeps the same persistence and activity-history behavior.
      const results = await Promise.all(overdueRows.map((row) => {
        const nextFollowUpDate = format(addDays(row.due, 7), "yyyy-MM-dd");
        return save(row.application, { followUpDate: nextFollowUpDate, followUps: false }, `Rescheduled follow-up with ${row.application.companyName} to ${nextFollowUpDate}`, false);
      }));
      const savedCount = results.filter(Boolean).length;
      if (savedCount === overdueRows.length) {
        toast({ title: "Overdue follow-ups rescheduled", description: `${savedCount} follow-up${savedCount === 1 ? " was" : "s were"} moved by one week.` });
      } else {
        toast({ title: "Some follow-ups were not rescheduled", description: `${savedCount} of ${overdueRows.length} follow-ups were saved. Please retry the remaining rows.`, variant: "destructive" });
      }
    } finally {
      setBulkRescheduling(false);
      setConfirmBulkReschedule(false);
    }
  }

  async function changeApplicationStatus(application: JobApplication, responseStatus: string) {
    if (!onUpdate || pendingIds.current.has(application.id)) return;
    const current = applications.find((item) => item.id === application.id);
    if (!current) return;
    pendingIds.current.add(application.id);
    setSavingIds(new Set(pendingIds.current));
    // Reuse the application-list transition so both status fields and structured history stay synchronized.
    const updated = buildResponseStatusChangeApplication(current, responseStatus, generateId(), new Date().toISOString());
    try {
      await onUpdate(updated);
      toast({ title: `${application.companyName} moved to ${responseStatus}.`, description: "The application status was saved." });
    } catch {
      toast({ title: "Status not saved", description: "The application kept its existing status. Please retry.", variant: "destructive" });
    } finally {
      pendingIds.current.delete(application.id);
      setSavingIds(new Set(pendingIds.current));
    }
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

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    // Follow the ARIA tabs keyboard pattern while keeping pointer and touch selection unchanged.
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? FOLLOW_UP_TABS.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + FOLLOW_UP_TABS.length) % FOLLOW_UP_TABS.length;
    setTab(FOLLOW_UP_TABS[nextIndex]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Follow-ups" description="Follow-ups more than 30 days overdue are ignored automatically. Reschedule one to bring it back." actions={<Button asChild variant="outline"><Link to="/app/add"><Plus />Add follow-up</Link></Button>} />

      {overdueRows.length > 0 && <section className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Overdue follow-up summary"><p className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{overdueRows.length} follow-up{overdueRows.length === 1 ? " is" : "s are"} overdue</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!onUpdate || bulkRescheduling || overdueRows.some((row) => savingIds.has(row.application.id))} onClick={() => setConfirmBulkReschedule(true)}>Reschedule all</Button><Button variant="secondary" size="sm" onClick={() => setTab("overdue")}>Review one by one</Button></div></section>}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Follow-up status">
          {FOLLOW_UP_TABS.map((item) => {
            const index = FOLLOW_UP_TABS.indexOf(item);
            return <button key={item} id={`follow-up-tab-${item}`} type="button" role="tab" aria-controls="follow-up-panel" aria-selected={tab === item} aria-label={`${FOLLOW_UP_TAB_LABELS[item]} (${tabCounts[item]})`} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={(event) => handleTabKeyDown(event, index)} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${tab === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span>{FOLLOW_UP_TAB_LABELS[item]}</span><span className="ml-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground" aria-hidden="true">{tabCounts[item]}</span></button>;
          })}
        </div>
        <div className="relative w-full shrink-0 md:w-44 lg:w-52"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search follow-ups" placeholder="Search follow-ups" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-9 text-xs" /></div>
      </div>

      <section id="follow-up-panel" role="tabpanel" aria-labelledby={`follow-up-tab-${tab}`} className="space-y-5">
        {visible.length === 0 ? <div className="app-panel flex flex-col items-center py-14 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarClock /></span><p className="text-sm font-semibold">No follow-ups in this view</p><p className="mt-1 text-xs text-muted-foreground">Try another tab or adjust your search.</p></div> : FOLLOW_UP_DISPLAY_ORDER.map((state) => {
          const groupRows = visible.filter((row) => row.state === state);
          if (groupRows.length === 0) return null;
          // Grouped cards mirror the urgency-first reference while preserving the shared status editor and row mutations.
          return <section key={state} aria-labelledby={`follow-up-group-${state}`}><div className="mb-3 flex items-center gap-3"><h2 id={`follow-up-group-${state}`} className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">{state === "overdue" ? "Overdue" : FOLLOW_UP_TAB_LABELS[state]}</h2><span className="h-px flex-1 bg-border" /></div><div className="space-y-2" role="list">{groupRows.map((row) => <article key={row.application.id} role="listitem" data-testid="follow-up-row" className={`app-panel grid gap-4 p-4 md:grid-cols-[minmax(220px,1.05fr)_minmax(230px,1.45fr)_minmax(130px,0.65fr)_auto] md:items-center ${row.state === "overdue" ? "border-l-4 border-l-destructive" : ""}`}>
            <div className="flex min-w-0 items-center gap-3">{/* Shared company logo service keeps follow-up rows visually aligned with the applications table. */}<CompanyLogo size="md" companyName={row.application.companyName} jobLink={row.application.jobLink} companyDomain={row.application.companyDomain} companyLogoUrl={row.application.companyLogoUrl} /><div className="min-w-0"><p className="truncate text-sm font-bold">{row.application.companyName}</p><p className="truncate text-xs text-muted-foreground">{row.application.jobTitle}</p></div></div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">{row.state === "completed" ? "Logged:" : "Suggested:"}</span><span className={row.state === "completed" ? "font-medium text-emerald-600" : "font-medium"}>{row.state === "completed" ? "Follow-up completed" : row.state === "ignored" ? "Review or reschedule this reminder" : "Send a status check-in email"}</span><ResponseStatusSelect status={row.applicationStatus} options={statusOptions} label={`Change status for ${row.application.jobTitle} at ${row.application.companyName}`} disabled={!onUpdate || savingIds.has(row.application.id)} onChange={(status) => void changeApplicationStatus(row.application, status)} /></div>
            <div className={`text-xs ${row.state === "overdue" ? "text-destructive" : row.state === "completed" ? "text-emerald-600" : "text-muted-foreground"}`}><p className="font-semibold">{followUpStatusLabel(row.state, row.days)}</p><p className="mt-0.5 font-normal text-muted-foreground">{row.hasDueDate ? `${row.state === "upcoming" ? "Due" : "Was due"} ${formatDisplayDate(row.application.followUpDate)}` : row.state === "completed" ? "Action logged" : "No due date"}</p></div>
            <div className="flex flex-wrap items-center justify-end gap-2">{row.state !== "completed" ? <><Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => void save(row.application, { followUps: true, followUpDate: "" }, `Completed follow-up with ${row.application.companyName}`)}><Check />Mark done</Button><Button variant="outline" size="sm" disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => void snoozeOneWeek(row.application)}><CalendarClock />Snooze 1 week</Button></> : <Button variant="outline" size="sm" disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => { setNextDate(format(addDays(now, 7), "yyyy-MM-dd")); setRescheduling(row.application); }}>Reopen</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" disabled={savingIds.has(row.application.id)} aria-label={`Actions for ${row.application.companyName}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{row.state !== "completed" && <DropdownMenuItem disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => void save(row.application, { followUps: true, followUpDate: "" }, `Completed follow-up with ${row.application.companyName}`)}><Check className="mr-2 h-4 w-4" />Mark complete</DropdownMenuItem>}<DropdownMenuItem disabled={!onUpdate || savingIds.has(row.application.id)} onClick={() => { setNextDate(row.application.followUpDate || format(addDays(now, 7), "yyyy-MM-dd")); setRescheduling(row.application); }}><CalendarClock className="mr-2 h-4 w-4" />Reschedule</DropdownMenuItem><DropdownMenuItem onClick={async () => { await navigator.clipboard.writeText(emailTemplate(row.application)); toast({ title: "Message copied", description: "The email follow-up is ready to paste." }); }}><Mail className="mr-2 h-4 w-4" />Copy email</DropdownMenuItem><DropdownMenuItem asChild><Link to={`/app/applications/${row.application.id}`}>Open application</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
          </article>)}</div></section>;
        })}
      </section>
      <p className="text-[10px] leading-5 text-muted-foreground">Completed means you logged a follow-up action. Ignored reminders are more than 30 days overdue and have not been marked done.</p>
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
      <Dialog open={confirmBulkReschedule} onOpenChange={(open) => { if (!bulkRescheduling) setConfirmBulkReschedule(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule all overdue follow-ups?</DialogTitle><DialogDescription>This will move the due date for all {overdueRows.length} currently overdue follow-up{overdueRows.length === 1 ? "" : "s"} forward by seven days.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={bulkRescheduling} onClick={() => setConfirmBulkReschedule(false)}>Cancel</Button>
            <Button type="button" disabled={!onUpdate || bulkRescheduling || overdueRows.length === 0} onClick={() => void rescheduleAllOverdue()}>{bulkRescheduling ? "Rescheduling..." : "Reschedule all"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
