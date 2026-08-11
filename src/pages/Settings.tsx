import type { User } from "firebase/auth";
import { Cloud, CloudOff, Database, ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";

export default function Settings({ mode, user, syncing, pendingSyncCount, offline }: { mode: "demo" | "owner"; user?: User; syncing: boolean; pendingSyncCount: number; offline: boolean }) {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Workspace identity, data mode, and privacy details." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="app-panel overflow-hidden"><div className="app-panel-title flex items-center gap-2"><Database className="h-4 w-4 text-primary" />Workspace</div><dl className="divide-y text-xs"><div className="flex items-center justify-between gap-4 p-4"><dt className="text-muted-foreground">Mode</dt><dd><Badge variant="secondary">{mode === "owner" ? "Private owner" : "Public demo"}</Badge></dd></div><div className="flex items-center justify-between gap-4 p-4"><dt className="text-muted-foreground">Account</dt><dd className="max-w-[65%] truncate font-medium">{user?.email || "Not signed in"}</dd></div><div className="flex items-center justify-between gap-4 p-4"><dt className="text-muted-foreground">Sync</dt><dd className="flex items-center gap-1.5 font-medium">{offline || pendingSyncCount > 0 ? <CloudOff className="h-4 w-4 text-amber-600" /> : <Cloud className="h-4 w-4 text-emerald-600" />}{/* A durable pending count distinguishes locally complete work from cloud-confirmed work. */}{syncing ? "Syncing" : pendingSyncCount > 0 ? `${pendingSyncCount} pending cloud sync` : offline ? "Offline" : mode === "owner" ? "Firestore synced" : "Browser local"}</dd></div></dl></section>
        <section className="app-panel overflow-hidden"><div className="app-panel-title flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Privacy boundaries</div><div className="space-y-3 p-4 text-xs leading-5 text-muted-foreground"><p>Demo data is synthetic and isolated to this browser. Owner imports are saved in a UID-scoped browser outbox first, then synchronized to the authenticated Firestore workspace.</p><p>AI summaries exclude notes, job links, recruiter details, and custom field values.</p><Link to="/" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">View JK.space portfolio <ExternalLink className="h-3.5 w-3.5" /></Link></div></section>
      </div>
    </div>
  );
}
