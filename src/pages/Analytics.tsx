import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { ArrowRight, BarChart3, BriefcaseBusiness, Clock3, Loader2, Send, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import type { JobApplication } from "@/lib/types";
import type { AiInsights } from "@/lib/aiInsights";
import { buildAiInsightSummary, generateAiInsightsWithFallback, getConfiguredOllamaModel } from "@/lib/aiInsights";
import { buildJobSearchMetrics } from "@/lib/jobSearchMetrics";
import { getLastImportMetadata } from "@/lib/storage";
import { formatDisplayDate } from "@/lib/utils";

export default function Analytics({ applications, isDemo = false, user }: { applications: JobApplication[]; isDemo?: boolean; user?: User }) {
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [importMetadata, setImportMetadata] = useState(() => isDemo ? null : getLastImportMetadata());
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    // Workbook identity can change without changing row count, so refresh source context on every dataset update.
    setImportMetadata(isDemo ? null : getLastImportMetadata());
  }, [applications, isDemo]);

  const metrics = useMemo(() => buildJobSearchMetrics(applications, now), [applications, now]);
  const titles = useMemo(() => {
    const counts = new Map<string, number>();
    applications.forEach((application) => counts.set(application.jobTitle, (counts.get(application.jobTitle) || 0) + 1));
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [applications]);

  const qualityMissing = applications.length - metrics.qualityCoverageCount;
  // Keep suggested actions direct while preserving the existing metric-based conditions.
  const recommendations = [
    { text: metrics.followUpsDue ? `Clear ${metrics.followUpsDue} overdue follow-up${metrics.followUpsDue === 1 ? "" : "s"} — reply, reschedule, or close them out.` : "You have no overdue follow-ups.", action: "Open", href: "/app/follow-ups" },
    { text: metrics.stale ? `${metrics.stale} applications have gone quiet. Review and archive any that are no longer active.` : "No applications have gone 21 days without an update.", action: "Review", href: "/app/applications" },
    { text: qualityMissing ? `${qualityMissing} applications are missing role-fit or tailored-resume tracking. Add it so the qualified count stays accurate.` : "Role-fit and tailored-resume tracking is complete.", action: "Fix", href: "/app/applications" },
  ];
  const firstTrendWeek = metrics.weeklyTrend[0]?.week;
  const lastTrendWeek = metrics.weeklyTrend.at(-1)?.week;

  async function handleGenerateAiInsights() {
    if (isDemo || !user) return;
    setAiLoading(true);
    setAiError("");
    try {
      // Only aggregate summary data leaves the browser; private notes and recruiter details are excluded upstream.
      const idToken = await user.getIdToken();
      const summary = buildAiInsightSummary(applications, now, importMetadata);
      setAiInsights(await generateAiInsightsWithFallback(summary, idToken));
    } catch (error) {
      setAiInsights(null);
      setAiError(error instanceof Error ? error.message : `Start Ollama and pull ${getConfiguredOllamaModel()}.`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Job search overview"
        description="How your search is going, and what to do next."
        actions={<Button onClick={handleGenerateAiInsights} disabled={isDemo || !user || aiLoading || applications.length === 0}>{aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />} {isDemo ? "Log in for guidance" : aiInsights ? "Refresh guidance" : "Generate guidance"}</Button>}
      />

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Search health">
        <div className="app-panel p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Send className="h-4 w-4 text-primary" />This week</div>
          <p className="mt-4 text-4xl font-bold tabular-nums">{metrics.qualifiedThisWeek}</p>
          <p className="mt-1 text-sm font-semibold">qualified applications sent</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Your typical week is {metrics.recentQualifiedWeeklyMedian}. Qualified means strong or moderate fit with a tailored resume.</p>
        </div>
        <div className="app-panel p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Clock3 className="h-4 w-4 text-amber-600" />In progress</div>
          <p className="mt-4 text-4xl font-bold tabular-nums">{metrics.activeProcess}</p>
          <p className="mt-1 text-sm font-semibold">applications in an active process</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{metrics.awaitingHumanResponse} waiting on a reply · {metrics.stale} have gone quiet</p>
        </div>
        <div className="app-panel p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-4 w-4 text-primary" />Moved forward</div>
          <p className="mt-4 text-4xl font-bold tabular-nums">{metrics.positiveProgression.rate}%</p>
          <p className="mt-1 text-sm font-semibold">of mature applications advanced</p>
          {/* Keep the sample-size caveat beside the rate it qualifies. */}
          <p className="mt-2 inline-flex max-w-full rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold leading-4 text-muted-foreground">{metrics.positiveProgression.signal === "low-signal" ? `Early days — ${metrics.positiveProgression.count} of ${metrics.positiveProgression.denominator}. Too few data points yet.` : `${metrics.positiveProgression.count} of ${metrics.positiveProgression.denominator} mature applications moved forward`}</p>
        </div>
      </section>

      {(aiInsights || aiError) && (
        <section className="app-panel p-5" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">AI guidance</h2><span className="text-[10px] text-muted-foreground">Guidance, not a guaranteed prediction</span></div>
          {aiError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{aiError}</p>}
          {aiInsights && <div className="space-y-4"><p className="text-sm leading-6">{aiInsights.summary}</p><div className="grid gap-3 md:grid-cols-3">{[
            ["Strengths", aiInsights.strengths], ["Improve", aiInsights.improvementAreas], ["Next actions", aiInsights.recommendedNextActions],
          ].map(([title, items]) => <div key={title as string} className="rounded-md border bg-muted/30 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title as string}</p><ul className="space-y-2">{(items as string[]).map((item) => <li key={item} className="text-xs leading-5">{item}</li>)}</ul></div>)}</div></div>}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]" aria-label="Job search analytics">
        <div className="app-panel overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-primary" />Qualified applications by week</h2>{firstTrendWeek && lastTrendWeek && <span className="shrink-0 text-xs text-muted-foreground">{firstTrendWeek} – {lastTrendWeek}</span>}</div>
          <div className="mt-5" role="img" aria-label="Thirteen-week qualified and all-application trend"><ResponsiveContainer width="100%" height={220}><LineChart data={metrics.weeklyTrend}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="total" name="All applications" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} strokeWidth={2} dot={false} /><Line type="monotone" dataKey="qualified" name="Qualified applications" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))" }} /></LineChart></ResponsiveContainer>{/* Match the legend labels to the exact weeklyTrend series keys. */}<div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-primary" />Qualified applications</span><span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-muted-foreground/40" />All applications</span></div></div>
        </div>
        <div className="app-panel overflow-hidden p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-primary" />Where things stand</h2>
          <div className="mt-5 space-y-4">
            {metrics.funnel.map((item) => {
              const width = metrics.cohort.size ? Math.round((item.count / metrics.cohort.size) * 100) : 0;
              // Rename the display label without changing the shared funnel data.
              const stageLabel = item.stage === "Positive progression" ? "Moved forward" : item.stage;
              return <div key={item.stage}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold">{stageLabel}</span><span className="tabular-nums text-muted-foreground">{item.count}/{metrics.cohort.size}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div></div>;
            })}
            <p className="pt-2 text-xs leading-5 text-muted-foreground">Counts every mature application that ever reached each stage, not just where it sits today. Cohort: {formatDisplayDate(metrics.cohort.start)}–{formatDisplayDate(metrics.cohort.end)}.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="app-panel overflow-hidden p-5 sm:p-6">
          <h2 className="text-sm font-bold">What to do next</h2>
          <ol className="mt-4 divide-y">{recommendations.map((item, index) => <li key={item.text} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><p className="min-w-0 flex-1 text-xs leading-5">{item.text}</p><Button asChild variant="link" size="sm" className="h-auto shrink-0 p-0 text-xs"><Link to={item.href}>{item.action}<ArrowRight className="h-3.5 w-3.5" /></Link></Button></li>)}</ol>
        </div>
        <div className="app-panel overflow-hidden p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold"><BriefcaseBusiness className="h-4 w-4 text-primary" />Roles you’ve applied to most</h2>
          <div className="mt-5">{titles.length ? <ol className="space-y-4">{titles.map(({ name, count }) => { const largestCount = titles[0]?.count || 1; return <li key={name} aria-label={`${name}: ${count} application${count === 1 ? "" : "s"}`} className="grid grid-cols-[minmax(110px,0.8fr)_minmax(120px,1.2fr)_auto] items-center gap-3"><span className="truncate text-xs font-semibold">{name}</span><span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(8, Math.round((count / largestCount) * 100))}%` }} /></span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span></li>; })}</ol> : <p className="py-20 text-center text-xs text-muted-foreground">Add applications to see your most frequent job titles.</p>}</div>
        </div>
      </section>

      <p className="text-[10px] text-muted-foreground">{importMetadata ? `Using XLSX import: ${importMetadata.fileName}` : "Using current application records"} · {metrics.invalidOrFutureDateCount ? `${metrics.invalidOrFutureDateCount} invalid/future dates excluded · ` : ""}AI output is guidance, not a hiring prediction.</p>
    </div>
  );
}
