import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, Edit2, Save, X } from "lucide-react";
import type { JobApplication, CurrentStatus, ActivityLogEntry } from "@/lib/types";
import { CURRENT_STATUSES, RESPONSE_STATUSES } from "@/lib/types";
import { updateApplication } from "@/lib/storage";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function generateId() { return Math.random().toString(36).substring(2, 9); }

export default function ApplicationDetail({ application, onBack, onUpdate }: { application: JobApplication; onBack: () => void; onUpdate: () => void }) {
  const [app, setApp] = useState<JobApplication>({ ...application });
  const [editing, setEditing] = useState(false);
  const [followNote, setFollowNote] = useState("");
  const { toast } = useToast();

  function save() {
    updateApplication(app);
    onUpdate();
    setEditing(false);
    toast({ title: "Saved", description: "Application updated." });
  }

  function changeStatus(status: CurrentStatus) {
    const entry: ActivityLogEntry = { id: generateId(), date: new Date().toISOString(), type: "status_change", message: `Status changed to ${status}` };
    const updated = { ...app, currentStatus: status, activityLog: [entry, ...app.activityLog] };
    setApp(updated);
    updateApplication(updated);
    onUpdate();
    toast({ title: "Status Updated", description: `Marked as ${status}` });
  }

  function addFollowUp() {
    if (!followNote.trim()) return;
    const entry: ActivityLogEntry = { id: generateId(), date: new Date().toISOString(), type: "follow_up", message: followNote };
    const updated = { ...app, followUps: true, activityLog: [entry, ...app.activityLog] };
    setApp(updated);
    updateApplication(updated);
    onUpdate();
    setFollowNote("");
    toast({ title: "Follow-up Added" });
  }

  const fields = [
    { label: "Job Title", key: "jobTitle" as const },
    { label: "Company", key: "companyName" as const },
    { label: "Location", key: "location" as const },
    { label: "Date Applied", key: "dateApplied" as const },
    { label: "Follow-Up Date", key: "followUpDate" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{app.jobTitle}</h1>
          <p className="text-muted-foreground">{app.companyName} · {app.location}</p>
        </div>
        <StatusBadge status={app.currentStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Details</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => editing ? save() : setEditing(true)}>
              {editing ? <><Save className="h-3.5 w-3.5 mr-1" />Save</> : <><Edit2 className="h-3.5 w-3.5 mr-1" />Edit</>}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                {editing ? (
                  <Input value={app[f.key]} onChange={(e) => setApp({ ...app, [f.key]: e.target.value })} className="mt-1" />
                ) : (
                  <p className="mt-1 text-sm">{app[f.key] || "—"}</p>
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
                <Select value={app.responseStatus} onValueChange={(v) => setApp({ ...app, responseStatus: v as any })}>
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
          </CardContent>
        </Card>

        {/* Quick Actions + Follow-up */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {CURRENT_STATUSES.filter((s) => s !== app.currentStatus).map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => changeStatus(s)}>{s}</Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Add Follow-up</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Follow-up note..." value={followNote} onChange={(e) => setFollowNote(e.target.value)} rows={3} />
              <Button size="sm" onClick={addFollowUp} disabled={!followNote.trim()} className="w-full">Add Entry</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Timeline */}
      {app.activityLog.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
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
