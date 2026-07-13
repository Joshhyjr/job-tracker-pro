import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, CalendarDays, Clock, AlertTriangle, TrendingUp, TrendingDown, Building2, BarChart3, Timer, Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { JobApplication } from "@/lib/types";
import type { User } from "firebase/auth";
import type { AiInsights } from "@/lib/aiInsights";
import { buildAiInsightSummary, generateAiInsightsWithFallback, getConfiguredOllamaModel } from "@/lib/aiInsights";
import { isBefore, startOfWeek, startOfMonth, parseISO, format, isValid, compareDesc, subDays, differenceInDays } from "date-fns";
import { isApplicationOverdue } from "@/lib/overdue";
import { computeStatusBreakdown, getResponseStatusColor, getResponseStatusBadgeStyle, isInterviewPipelineResponseStatus } from "@/lib/responseStatus";
import { getLastImportMetadata, getPreferredResponseStatusOrder } from "@/lib/storage";
import { formatDisplayDate } from "@/lib/utils";

/** Safely parse an ISO date string, returning null for blank/invalid values */
function safeParseDate(d: string) {
  if (!d) return null;
  const p = parseISO(d);
  return isValid(p) ? p : null;
}

export default function Dashboard({ applications, isDemo = false, user }: { applications: JobApplication[]; isDemo?: boolean; user?: User }) {
  const navigate = useNavigate();
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now]);
  const monthStart = useMemo(() => startOfMonth(now), [now]);
  const [importMetadata, setImportMetadata] = useState(() => isDemo ? null : getLastImportMetadata());

  useEffect(() => {
    // Imports can swap in a same-sized dataset, so re-read the workbook metadata after every visible application refresh.
    setImportMetadata(isDemo ? null : getLastImportMetadata());
  }, [applications, isDemo]);

  // Compute summary stats from the applications dataset
  const stats = useMemo(() => {
    let thisWeek = 0, thisMonth = 0, overdue = 0;

    applications.forEach((a) => {
      const d = safeParseDate(a.dateApplied);
      if (d) {
        if (!isBefore(d, weekStart)) thisWeek++;
        if (!isBefore(d, monthStart)) thisMonth++;
      }
      if (isApplicationOverdue(a, now)) overdue++;
    });

    return { total: applications.length, thisWeek, thisMonth, overdue };
  }, [applications, monthStart, now, weekStart]);

  // Dynamic status breakdown based on responseStatus field
  const statusBreakdown = useMemo(
    // Demo analytics must not reveal or depend on the owner's workbook-derived status configuration.
    () => computeStatusBreakdown(applications, isDemo ? [] : getPreferredResponseStatusOrder()),
    [applications, isDemo]
  );

  const pieData = statusBreakdown.map((item) => ({
    name: item.label,
    value: item.count,
    color: getResponseStatusColor(item.key),
    key: item.key,
  }));

  // Group applications by month for the bar chart
  const monthlyData = useMemo(() => {
    const map = new Map<string, { sortKey: string; label: string; count: number }>();
    applications.forEach((a) => {
      const d = safeParseDate(a.dateApplied);
      if (d) {
        const sortKey = format(d, "yyyy-MM");
        const label = format(d, "MMM yyyy");
        const entry = map.get(sortKey);
        if (entry) entry.count++;
        else map.set(sortKey, { sortKey, label, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [applications]);

  // 5 most recently applied jobs sorted by date descending
  const recentApplications = useMemo(() => {
    const withDate = applications
      .map((a) => ({ app: a, date: safeParseDate(a.dateApplied) }))
      .filter((item): item is { app: JobApplication; date: Date } => item.date !== null);
    withDate.sort((a, b) => compareDesc(a.date, b.date));
    return withDate.slice(0, 5).map((item) => item.app);
  }, [applications]);

  // Lightweight insights derived from existing application data only
  const insights = useMemo(() => {
    const items: { icon: typeof Briefcase; label: string; tone: "neutral" | "positive" | "warning" }[] = [];
    if (applications.length === 0) return items;

    // Most applied-to company
    const companyCounts = new Map<string, number>();
    applications.forEach((a) => {
      const c = (a.companyName || "").trim();
      if (c) companyCounts.set(c, (companyCounts.get(c) || 0) + 1);
    });
    const topCompany = [...companyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCompany && topCompany[1] > 1) {
      items.push({ icon: Building2, label: `Most applications sent to: ${topCompany[0]} (${topCompany[1]})`, tone: "neutral" });
    }

    // Most common response status
    if (statusBreakdown.length) {
      const top = [...statusBreakdown].sort((a, b) => b.count - a.count)[0];
      if (top && top.count > 0) {
        const isWarn = /no response|rejected/i.test(top.label);
        items.push({ icon: BarChart3, label: `Most common status: ${top.label} (${top.count})`, tone: isWarn ? "warning" : "neutral" });
      }
    }

    // Interview rate
    const interviewCount = applications.filter((a) => isInterviewPipelineResponseStatus(a.responseStatus)).length;
    if (applications.length >= 3) {
      const rate = Math.round((interviewCount / applications.length) * 100);
      items.push({
        icon: rate >= 15 ? TrendingUp : TrendingDown,
        label: `Your interview rate: ${rate}%`,
        tone: rate >= 15 ? "positive" : "warning",
      });
    }

    // No response after 14+ days
    const stale = applications.filter((a) => {
      const d = safeParseDate(a.dateApplied);
      if (!d) return false;
      return /no response/i.test(a.responseStatus || "") && differenceInDays(now, d) >= 14;
    }).length;
    if (stale > 0) {
      items.push({ icon: Timer, label: `No response after 14+ days: ${stale}`, tone: "warning" });
    }

    // This week vs last week
    const lastWeekStart = subDays(weekStart, 7);
    let thisWeekCount = 0, lastWeekCount = 0;
    applications.forEach((a) => {
      const d = safeParseDate(a.dateApplied);
      if (!d) return;
      if (!isBefore(d, weekStart)) thisWeekCount++;
      else if (!isBefore(d, lastWeekStart)) lastWeekCount++;
    });
    if (thisWeekCount || lastWeekCount) {
      const diff = thisWeekCount - lastWeekCount;
      const tone: "positive" | "warning" | "neutral" = diff > 0 ? "positive" : diff < 0 ? "warning" : "neutral";
      const verb = diff > 0 ? "more" : diff < 0 ? "fewer" : "same as";
      const label =
        diff === 0
          ? `You applied to ${thisWeekCount} jobs this week (same as last week)`
          : `You applied to ${thisWeekCount} this week — ${Math.abs(diff)} ${verb} than last week`;
      items.push({ icon: diff >= 0 ? TrendingUp : TrendingDown, label, tone });
    }

    return items.slice(0, 4);
  }, [applications, statusBreakdown, weekStart, now]);

  const metrics = [
    { label: "Total", value: stats.total, icon: Briefcase, color: "text-[hsl(var(--status-applied))]" },
    { label: "This Week", value: stats.thisWeek, icon: CalendarDays, color: "text-[hsl(var(--status-interview))]" },
    { label: "This Month", value: stats.thisMonth, icon: Clock, color: "text-[hsl(var(--status-offer))]" },
    { label: "Jobs Followed Up To", value: stats.overdue, icon: AlertTriangle, color: "text-[hsl(var(--status-rejected))]" },
  ];

  async function handleGenerateAiInsights() {
    if (isDemo || !user) return;
    setAiLoading(true);
    setAiError("");

    try {
      // Only summary fields are sent to Gemini or Ollama; notes, links, recruiters, and custom field values stay out of the prompt.
      const idToken = await user.getIdToken();
      const summary = buildAiInsightSummary(applications, now, importMetadata);
      const generated = await generateAiInsightsWithFallback(summary, idToken);
      setAiInsights(generated);
    } catch (error) {
      setAiInsights(null);
      setAiError(error instanceof Error ? error.message : `Start Ollama and pull the configured model (${getConfiguredOllamaModel()}).`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>

      {/* Metric cards — minimal, no heavy borders */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border-border/40 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status breakdown — clean card */}
        <Card className="border-border/40 shadow-none">
          <CardHeader><CardTitle className="text-base font-medium">Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" strokeWidth={1.5} stroke="hsl(var(--card))">
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  {/* Glass-styled tooltip */}
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div className="glass rounded-xl px-3 py-1.5 text-xs">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-muted-foreground">{d.value} applications</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1">
                {statusBreakdown.map((item) => (
                  <Button
                    key={item.key}
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2 text-xs"
                    onClick={() => navigate(`/app/applications?responseStatus=${encodeURIComponent(item.key)}`)}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: getResponseStatusColor(item.key) }} />
                    {item.label} ({item.count})
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly trend — minimalist bar chart */}
        <Card className="border-border/40 shadow-none">
          <CardHeader><CardTitle className="text-base font-medium">Monthly Applications</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barSize={18} barCategoryGap="60%">
                {/* Subtle horizontal grid only */}
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                {/* Glass tooltip for chart */}
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    return (
                      <div className="glass rounded-xl px-3 py-1.5 text-xs">
                        <p className="font-medium">{label}</p>
                        <p className="text-muted-foreground">{payload[0].value} applications</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications — compact, minimal, clickable rows */}
      <Card className="border-border/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent applications yet</p>
          ) : (
            <div className="space-y-1">
              {recentApplications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => navigate(`/app/applications/${app.id}`)}
                  className="flex w-full flex-col items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.companyName}</p>
                    <p className="truncate text-xs text-muted-foreground">{app.jobTitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Status pill uses the central colour helper so it matches the pie + legend */}
                    <span
                      className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                      style={getResponseStatusBadgeStyle(app.responseStatus)}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: getResponseStatusColor(app.responseStatus) }}
                      />
                      {app.responseStatus}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDisplayDate(app.dateApplied)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights & Recommendations — deterministic signals plus hosted Gemini or local Ollama coaching */}
      {(insights.length > 0 || aiInsights || applications.length > 0) && (
        <Card className="glass-subtle border-border/40 shadow-none">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Lightbulb className="h-4 w-4 text-[hsl(var(--status-offer))]" />
                Insights & Recommendations
              </CardTitle>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateAiInsights}
                disabled={isDemo || !user || aiLoading || applications.length === 0}
                className="w-full gap-2 sm:w-auto"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isDemo ? "Log in for AI insights" : aiInsights ? "Regenerate AI insights" : "Generate AI insights"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1">
                {importMetadata ? `Using XLSX import: ${importMetadata.fileName}` : "Using current dashboard records"}
              </span>
              {importMetadata && (
                <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1">
                  {importMetadata.rowCount} rows imported
                </span>
              )}
            </div>
            {isDemo ? (
              <p className="text-xs text-muted-foreground">AI generation is disabled in the public sandbox so private access tokens never appear in demo mode.</p>
            ) : (
              // Google authentication replaces the manual shared-secret field for the private owner workspace.
              <p className="text-xs text-muted-foreground">Gemini requests are authenticated with your signed-in Google session{user?.email ? ` (${user.email})` : ""}.</p>
            )}

            {aiError && (
              <div className="rounded-md border border-[hsl(var(--status-rejected)/0.25)] bg-[hsl(var(--status-rejected)/0.08)] px-3 py-2 text-sm text-[hsl(var(--status-rejected))]">
                {aiError}
              </div>
            )}

            {aiInsights && (
              <div className="space-y-3">
                {aiInsights.summary && (
                  <div className="glass rounded-xl px-3 py-3">
                    <p className="text-sm leading-relaxed">{aiInsights.summary}</p>
                  </div>
                )}
                <div className="grid gap-3 lg:grid-cols-3">
                  {[
                    { title: "Strengths", items: aiInsights.strengths },
                    { title: "Improve", items: aiInsights.improvementAreas },
                    { title: "Next Actions", items: aiInsights.recommendedNextActions },
                  ].map((section) => (
                    <div key={section.title} className="rounded-lg border border-border/50 bg-background/40 p-3">
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{section.title}</p>
                      <ul className="space-y-1.5">
                        {section.items.map((item) => (
                          <li key={item} className="text-sm leading-snug">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {insights.map((ins, i) => {
                  // Tone-based subtle color: green=positive, red/amber=warning
                  const toneColor =
                    ins.tone === "positive"
                      ? "text-[hsl(var(--status-offer))]"
                      : ins.tone === "warning"
                      ? "text-[hsl(var(--status-rejected))]"
                      : "text-muted-foreground";
                  return (
                    <div key={i} className="glass flex items-start gap-3 rounded-xl px-3 py-2.5">
                      <ins.icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneColor}`} />
                      <p className="text-sm leading-snug">{ins.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
