import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, Edit2, ExternalLink, Save, Trash2 } from "lucide-react";
import type { JobApplication, CurrentStatus, ActivityLogEntry } from "@/lib/types";
import { CURRENT_STATUSES, RESPONSE_STATUSES } from "@/lib/types";
import { updateApplication, deleteApplication, generateId } from "@/lib/storage";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@/lib/utils";
import { mapCurrentStatusToResponseStatus } from "@/lib/responseStatus";

export default function ApplicationDetail({ application, onBack, onUpdate }: { application: JobApplication; onBack: () => void; onUpdate: () => void }) {
  const [app, setApp] = useState<JobApplication>({ ...application });
  const [editing, setEditing] = useState(false);
  const [followNote, setFollowNote] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    // Route changes and parent refreshes can provide a newer record; reset the local draft to avoid saving stale data.
    setApp({ ...application });
    setEditing(false);
    setFollowNote("");
  }, [application]);

  // Keep local state, storage, and parent data synchronized after every mutation.
  function persistApplication(next: JobApplication) {
    setApp(next);
    updateApplication(next);
    onUpdate();
  }

  function save() {
    persistApplication(app);
    setEditing(false);
    toast({ title: "Saved", description: "Application updated." });
  }

  function changeStatus(status: CurrentStatus) {
    const entry: ActivityLogEntry = { id: generateId(), date: new Date().toISOString(), type: "status_change", message: `Status changed to ${status}` };
    // Keep quick status updates aligned with dashboard/filter metrics that are derived from responseStatus.
    const updated = {
      ...app,
      currentStatus: status,
      responseStatus: mapCurrentStatusToResponseStatus(status) ?? app.responseStatus,
      activityLog: [entry, ...app.activityLog],
    };
    persistApplication(updated);
    toast({ title: "Status Updated", description: `Marked as ${status}` });
  }

  function addFollowUp() {
    if (!followNote.trim()) return;
    const entry: ActivityLogEntry = { id: generateId(), date: new Date().toISOString(), type: "follow_up", message: followNote };
    const updated = { ...app, followUps: true, activityLog: [entry, ...app.activityLog] };
    persistApplication(updated);
    setFollowNote("");
    toast({ title: "Follow-up Added" });
  }

  function handleDelete() {
    if (confirm("Are you sure you want to delete this application?")) {
      deleteApplication(app.id);
      onUpdate();
      onBack();
      toast({ title: "Deleted", description: "Application removed." });
    }
  }

  const fields = [
    { label: "Job Title", key: "jobTitle" as const },
    { label: "Company", key: "companyName" as const },
    { label: "Location", key: "location" as const },
    { label: "Date Applied", key: "dateApplied" as const },
    { label: "Follow-Up Date", key: "followUpDate" as const },
  ];

  function getSafeExternalHref(value: string | undefined): string {
    if (!value) return "";
    try {
      // Imported links are untrusted, so only render clickable http(s) destinations.
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch {
      return "";
    }
  }

  const jobPostingHref = getSafeExternalHref(app.jobLink);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{app.jobTitle}</h1>
          <p className="text-muted-foreground">{app.companyName} · {app.location}</p>
        </div>
        <StatusBadge status={app.currentStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details — glass card for the detail view */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium">Details</h2>
            <div className="flex gap-2">
              {!editing && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => editing ? save() : setEditing(true)}>
                {editing ? <><Save className="h-3.5 w-3.5 mr-1" />Save</> : <><Edit2 className="h-3.5 w-3.5 mr-1" />Edit</>}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                {editing ? (
                  <div className="mt-1 space-y-2">
                    <Input value={app[f.key] ?? ""} onChange={(e) => setApp({ ...app, [f.key]: e.target.value })} />
                    {f.key === "jobTitle" && (
                      <Input value={app.jobLink ?? ""} onChange={(e) => setApp({ ...app, jobLink: e.target.value })} placeholder="Job posting URL" />
                    )}
                  </div>
                ) : (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm">
                      {f.key === "dateApplied" || f.key === "followUpDate" ? formatDisplayDate(app[f.key]) : (app[f.key] || "—")}
                    </p>
                    {f.key === "jobTitle" && jobPostingHref && (
                      <a
                        href={jobPostingHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        Open posting <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Current Status</label>
              {editing ? (
                <Select value={app.currentStatus} onValueChange={(v) => setApp({ ...app, currentStatus: v as CurrentStatus })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="mt-1 text-sm">{app.currentStatus}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Response Status</label>
              {editing ? (
                <Select value={app.responseStatus} onValueChange={(v) => setApp({ ...app, responseStatus: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESPONSE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="mt-1 text-sm">{app.responseStatus}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              {editing ? (
                <Textarea value={app.notes} onChange={(e) => setApp({ ...app, notes: e.target.value })} className="mt-1" />
              ) : <p className="mt-1 text-sm whitespace-pre-wrap">{app.notes || "—"}</p>}
            </div>
          </div>
        </div>

        {/* Sidebar — Quick Actions + Follow-up */}
        <div className="space-y-4">
          <Card className="border-border/40 shadow-none">
            <CardHeader><CardTitle className="text-base font-medium">Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {CURRENT_STATUSES.filter((s) => s !== app.currentStatus).map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => changeStatus(s)}>{s}</Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-none">
            <CardHeader><CardTitle className="text-base font-medium">Add Follow-up</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Follow-up note..." value={followNote} onChange={(e) => setFollowNote(e.target.value)} rows={3} />
              <Button size="sm" onClick={addFollowUp} disabled={!followNote.trim()} className="w-full">Add Entry</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Timeline */}
      {app.activityLog.length > 0 && (
        <Card className="border-border/40 shadow-none">
          <CardHeader><CardTitle className="text-base font-medium">Activity Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {app.activityLog.map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p>{entry.message}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(entry.date), "MMM d, yyyy h:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
