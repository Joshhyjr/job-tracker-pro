import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { BarChart3, BriefcaseBusiness, CheckCircle2, Lightbulb, Loader2, Sparkles, Target, TrendingUp } from "lucide-react";
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
  const keyInsights = [
    `${metrics.qualifiedThisWeek} qualified application${metrics.qualifiedThisWeek === 1 ? "" : "s"} this week; your recent completed-week median is ${metrics.recentQualifiedWeeklyMedian}.`,
    `${metrics.awaitingHumanResponse} applications are awaiting a human response and ${metrics.stale} are stale after 21 days.`,
    `Positive progression is ${metrics.positiveProgression.count}/${metrics.positiveProgression.denominator} (${metrics.positiveProgression.rate}%) in the mature cohort.`,
    `Interview progression is ${metrics.interviews.count}/${metrics.interviews.denominator} (${metrics.interviews.rate}%) in the same cohort.`,
    qualityMissing ? `${qualityMissing} applications are missing role-fit or tailored-resume tracking.` : "Role-fit and tailored-resume tracking is complete.",
  ];
  const recommendations = [
    metrics.followUpsDue ? `Complete or reschedule ${metrics.followUpsDue} confirmed follow-up${metrics.followUpsDue === 1 ? "" : "s"}.` : "No confirmed follow-ups are overdue.",
    metrics.stale ? `Review ${metrics.stale} stale applications and close or archive records that are no longer active.` : "Your awaiting-response queue has no stale records.",
    qualityMissing ? "Record role fit and resume tailoring on new applications so qualified pace stays trustworthy." : "Keep recording fit and tailoring at submission time.",
    metrics.positiveProgression.signal === "low-signal"
      ? "Treat conversion as an early signal until the cohort has at least 20 applications and five positive progressions."
      : "Use the mature-cohort funnel to review targeting changes without relying on generic benchmarks.",
  ];

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
        title="AI & Analytics"
        description="Transparent activity, pipeline, and outcome measures for your job search."
        actions={<Button size="sm" onClick={handleGenerateAiInsights} disabled={isDemo || !user || aiLoading || applications.length === 0}>{aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />} {isDemo ? "Log in for AI guidance" : aiInsights ? "Refresh AI guidance" : "Generate AI guidance"}</Button>}
      />

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Search health">
        <div className="app-panel p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Target className="h-4 w-4 text-primary" />ACTIVITY</div>
          <p className="mt-4 text-4xl font-bold tabular-nums">{metrics.qualifiedThisWeek}</p>
          <p className="mt-1 text-sm font-semibold">Qualified applications this week</p>
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">Recent completed-week median: {metrics.recentQualifiedWeeklyMedian}. Qualified means strong/moderate fit with a tailored resume.</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><TrendingUp className="h-4 w-4 text-emerald-600" />PIPELINE</div>
          <p className="mt-4 text-4xl font-bold tabular-nums">{metrics.activeProcess}</p>
          <p className="mt-1 text-sm font-semibold">Applications in an active process</p>
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">{metrics.awaitingHumanResponse} awaiting a human response · {metrics.stale} stale after 21 days · auto-replies are acknowledgements only.</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-amber-500" />OUTCOMES</div>
          <p className="mt-4 text-4xl font-bold tabular-nums">{metrics.positiveProgression.rate}%</p>
          <p className="mt-1 text-sm font-semibold">Positive progression</p>
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">{metrics.positiveProgression.count}/{metrics.positiveProgression.denominator} mature applications · {metrics.interviews.count}/{metrics.interviews.denominator} reached interview · {metrics.positiveProgression.signal === "low-signal" ? "low-signal" : "established"} evidence.</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><Lightbulb className="h-4 w-4 text-emerald-600" />Key Insights</div>
          <ul className="space-y-3 p-4">{keyInsights.map((item) => <li key={item} className="flex gap-2 text-xs leading-5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul>
        </section>
        <section className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" />Next Actions</div>
          <ul className="space-y-3 p-4">{recommendations.map((item) => <li key={item} className="flex gap-2 text-xs leading-5"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{item}</li>)}</ul>
        </section>
      </div>

      {(aiInsights || aiError) && (
        <section className="app-panel p-5" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">AI guidance</h2><span className="text-[10px] text-muted-foreground">Guidance, not a guaranteed prediction</span></div>
          {aiError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{aiError}</p>}
          {aiInsights && <div className="space-y-4"><p className="text-sm leading-6">{aiInsights.summary}</p><div className="grid gap-3 md:grid-cols-3">{[
            ["Strengths", aiInsights.strengths], ["Improve", aiInsights.improvementAreas], ["Next actions", aiInsights.recommendedNextActions],
          ].map(([title, items]) => <div key={title as string} className="rounded-md border bg-muted/30 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title as string}</p><ul className="space-y-2">{(items as string[]).map((item) => <li key={item} className="text-xs leading-5">{item}</li>)}</ul></div>)}</div></div>}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Job search analytics">
        <div className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Qualified Applications by Week</div>
          <div className="p-4" role="img" aria-label="Thirteen-week qualified application trend"><ResponsiveContainer width="100%" height={250}><LineChart data={metrics.weeklyTrend}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="total" name="All applications" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} /><Line type="monotone" dataKey="qualified" name="Qualified" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))" }} /></LineChart></ResponsiveContainer></div>
        </div>
        <div className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Mature Cohort Funnel</div>
          <div className="space-y-4 p-4">
            {metrics.funnel.map((item) => {
              const width = metrics.cohort.size ? Math.round((item.count / metrics.cohort.size) * 100) : 0;
              return <div key={item.stage}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold">{item.stage}</span><span className="tabular-nums text-muted-foreground">{item.count}/{metrics.cohort.size}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div></div>;
            })}
            <p className="pt-2 text-[10px] leading-5 text-muted-foreground">Applied {formatDisplayDate(metrics.cohort.start)}–{formatDisplayDate(metrics.cohort.end)}. Rates use stages ever reached, including structured status history.</p>
          </div>
        </div>
        <div className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-primary" />Job Titles Applied to Most</div>
          <div className="p-4">{titles.length ? <ol className="space-y-4">{titles.map(({ name, count }) => { const largestCount = titles[0]?.count || 1; return <li key={name} aria-label={`${name}: ${count} application${count === 1 ? "" : "s"}`}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold">{name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, Math.round((count / largestCount) * 100))}%` }} /></div></li>; })}</ol> : <p className="py-20 text-center text-xs text-muted-foreground">Add applications to see your most frequent job titles.</p>}</div>
        </div>
      </section>

      <p className="text-[10px] text-muted-foreground">{importMetadata ? `Using XLSX import: ${importMetadata.fileName}` : "Using current application records"} · {metrics.invalidOrFutureDateCount ? `${metrics.invalidOrFutureDateCount} invalid/future dates excluded · ` : ""}AI output is guidance, not a hiring prediction.</p>
    </div>
  );
}
