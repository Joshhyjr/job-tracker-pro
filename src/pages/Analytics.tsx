import { useEffect, useMemo, useState } from "react";
import { differenceInDays, format, isValid, parseISO } from "date-fns";
import type { User } from "firebase/auth";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import type { JobApplication } from "@/lib/types";
import type { AiInsights } from "@/lib/aiInsights";
import { buildAiInsightSummary, generateAiInsightsWithFallback, getConfiguredOllamaModel } from "@/lib/aiInsights";
import { computeStatusBreakdown, isInterviewPipelineResponseStatus, normalizeResponseStatus } from "@/lib/responseStatus";
import { getLastImportMetadata } from "@/lib/storage";

function parseDate(value: string): Date | null {
  const date = parseISO(value || "");
  return isValid(date) ? date : null;
}

const NON_RESPONSE_STATUSES = new Set(["Applied", "No Response", "Auto-reply received"]);

// Overall and monthly response rates share one definition so the KPI and trend cannot drift.
function hasMeaningfulResponse(application: JobApplication) {
  return !NON_RESPONSE_STATUSES.has(normalizeResponseStatus(application.responseStatus));
}

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

  const analysis = useMemo(() => {
    const interviewCount = applications.filter((application) => isInterviewPipelineResponseStatus(application.responseStatus)).length;
    const responseCount = applications.filter(hasMeaningfulResponse).length;
    const followedUp = applications.filter((application) => application.followUps).length;
    const stale = applications.filter((application) => {
      const date = parseDate(application.dateApplied);
      return date && normalizeResponseStatus(application.responseStatus) === "No Response" && differenceInDays(now, date) >= 14;
    }).length;
    const responseRate = applications.length ? Math.round((responseCount / applications.length) * 100) : 0;
    const interviewRate = applications.length ? Math.round((interviewCount / applications.length) * 100) : 0;
    const followUpRate = applications.length ? Math.round((followedUp / applications.length) * 100) : 0;
    const score = Math.min(100, Math.round(responseRate * 0.35 + interviewRate * 0.3 + followUpRate * 0.25 + Math.min(applications.length, 20) * 0.5));

    const countries = new Map<string, number>();
    const titles = new Map<string, number>();
    applications.forEach((application) => {
      const country = application.country || application.location.split(",").at(-1)?.trim() || "Unknown";
      countries.set(country, (countries.get(country) || 0) + 1);
      titles.set(application.jobTitle, (titles.get(application.jobTitle) || 0) + 1);
    });

    const monthly = new Map<string, { sortKey: string; month: string; count: number; responses: number }>();
    applications.forEach((application) => {
      const date = parseDate(application.dateApplied);
      if (!date) return;
      const sortKey = format(date, "yyyy-MM");
      const item = monthly.get(sortKey);
      const responseIncrement = hasMeaningfulResponse(application) ? 1 : 0;
      if (item) {
        item.count += 1;
        item.responses += responseIncrement;
      } else {
        monthly.set(sortKey, { sortKey, month: format(date, "MMM yyyy"), count: 1, responses: responseIncrement });
      }
    });

    const monthlyTimeline = [...monthly.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-8);

    return {
      responseRate,
      interviewRate,
      followUpRate,
      stale,
      score,
      countries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
      titles: [...titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
      monthly: monthlyTimeline,
      responseTimeline: monthlyTimeline.map((item) => ({
        month: item.month,
        responseRate: Math.round((item.responses / item.count) * 100),
      })),
      statuses: computeStatusBreakdown(applications).sort((a, b) => b.count - a.count).slice(0, 8),
    };
  }, [applications, now]);

  const keyInsights = [
    `Your response rate is ${analysis.responseRate}%.`,
    `Your interview conversion is ${analysis.interviewRate}%.`,
    `${analysis.stale} applications have had no response for more than 14 days.`,
    analysis.countries[0] ? `Most applications are located in ${analysis.countries[0].name}.` : "Add location data to see your strongest market.",
    `You have followed up on ${analysis.followUpRate}% of tracked applications.`,
  ];
  const recommendations = [
    analysis.stale ? `Follow up on ${analysis.stale} overdue applications.` : "Keep your follow-up queue clear this week.",
    "Apply to five well-aligned roles this week.",
    "Tailor your resume for your most frequent job titles.",
    "Add specific SQL, Tableau, and Power BI evidence where relevant.",
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
        description="Measurable insights and practical guidance for your job search."
        actions={<Button size="sm" onClick={handleGenerateAiInsights} disabled={isDemo || !user || aiLoading || applications.length === 0}>{aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />} {isDemo ? "Log in for AI guidance" : aiInsights ? "Refresh AI guidance" : "Generate AI guidance"}</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr_1.15fr]">
        <section className="app-panel p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Target className="h-4 w-4 text-primary" />APPLICATION SUCCESS SCORE</div>
          <p className="mt-5 text-5xl font-bold tabular-nums">{analysis.score}<span className="text-lg text-muted-foreground">/100</span></p>
          <p className="mt-2 text-sm font-semibold">{analysis.score >= 70 ? "Good progress. Keep applying consistently." : "A solid base—focus on consistent applications and follow-ups."}</p>
          <div className="mt-5 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${analysis.score}%` }} /></div>
          <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Based on response rate, interview conversion, follow-up completion, application consistency, and role alignment.</p>
        </section>

        <section className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><Lightbulb className="h-4 w-4 text-emerald-600" />Key Insights</div>
          <ul className="space-y-3 p-4">
            {keyInsights.map((item) => <li key={item} className="flex gap-2 text-xs leading-5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{item}</li>)}
          </ul>
        </section>

        <section className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" />Recommendations</div>
          <ul className="space-y-3 p-4">
            {recommendations.map((item) => <li key={item} className="flex gap-2 text-xs leading-5"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{item}</li>)}
          </ul>
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
        <div className="app-panel overflow-hidden"><div className="app-panel-title flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Monthly Application Volume</div><div className="p-4"><ResponsiveContainer width="100%" height={250}><LineChart data={analysis.monthly}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Line dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))" }} /></LineChart></ResponsiveContainer></div></div>
        <div className="app-panel overflow-hidden"><div className="app-panel-title flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Response Rate Over Time</div><div className="p-4"><ResponsiveContainer width="100%" height={250}><LineChart data={analysis.responseTimeline}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="responseRate" name="Response rate" unit="%" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></div>
        {/* Rank frequent titles beside the trend cards without introducing a second analytics row. */}
        <div className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-primary" />Job titles applied to most</div>
          <div className="p-4">
            {analysis.titles.length ? (
              <ol className="space-y-4">
                {analysis.titles.map(({ name, count }) => {
                  const largestCount = analysis.titles[0]?.count || 1;
                  return (
                    <li key={name} aria-label={`${name}: ${count} application${count === 1 ? "" : "s"}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-semibold">{name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{count} application{count === 1 ? "" : "s"}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, Math.round((count / largestCount) * 100))}%` }} /></div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="py-20 text-center text-xs text-muted-foreground">Add applications to see your most frequent job titles.</p>}
          </div>
        </div>
      </section>

      {/* Conversion summaries already appear in the score and insights, so the charts remain the final analytics row. */}
      <p className="text-[10px] text-muted-foreground">{importMetadata ? `Using XLSX import: ${importMetadata.fileName}` : "Using current application records"} · AI output is guidance, not a hiring prediction.</p>
    </div>
  );
}
