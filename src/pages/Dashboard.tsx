import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { compareDesc, format, isBefore, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";
import {
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileDown,
  FileSpreadsheet,
  
  PhoneCall,
  Plus,
  Upload,
  XCircle,
} from "lucide-react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ExcelDropZone from "@/components/ExcelDropZone";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import type { JobApplication } from "@/lib/types";
import { exportCSV, exportXLSX } from "@/lib/export";
import { isApplicationOverdue } from "@/lib/overdue";
import {
  computeStatusBreakdown,
  getResponseStatusColor,
  isInterviewPipelineResponseStatus,
  normalizeResponseStatus,
} from "@/lib/responseStatus";
import { getPreferredResponseStatusOrder } from "@/lib/storage";
import { formatDisplayDate } from "@/lib/utils";
import { CompanyLogo } from "@/components/CompanyLogo";

function safeDate(value: string): Date | null {
  const parsed = parseISO(value || "");
  return isValid(parsed) ? parsed : null;
}

export default function Dashboard({
  applications,
  isDemo = false,
  onImportXLSX,
}: {
  applications: JobApplication[];
  isDemo?: boolean;
  onImportXLSX?: (file: File) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [chartRange, setChartRange] = useState<"3" | "6" | "12" | "all">("6");
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now]);
  const monthStart = useMemo(() => startOfMonth(now), [now]);

  const metrics = useMemo(() => {
    const thisWeek = applications.filter((application) => {
      const date = safeDate(application.dateApplied);
      return date ? !isBefore(date, weekStart) : false;
    }).length;
    const thisMonth = applications.filter((application) => {
      const date = safeDate(application.dateApplied);
      return date ? !isBefore(date, monthStart) : false;
    }).length;
    const followedUp = applications.filter((application) => application.followUps).length;
    const interviews = applications.filter((application) => isInterviewPipelineResponseStatus(application.responseStatus)).length;
    const rejections = applications.filter((application) => normalizeResponseStatus(application.responseStatus) === "Rejected").length;
    return [
      { label: "Total Applications", value: applications.length, icon: BriefcaseBusiness, tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/50" },
      { label: "This Week", value: thisWeek, icon: CalendarDays, tone: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50" },
      { label: "This Month", value: thisMonth, icon: Clock3, tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/50" },
      { label: "Followed Up", value: followedUp, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
      { label: "Interviews", value: interviews, icon: PhoneCall, tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
      { label: "Rejections", value: rejections, icon: XCircle, tone: "text-red-600 bg-red-50 dark:bg-red-950/50" },
    ];
  }, [applications, monthStart, weekStart]);

  const statusData = useMemo(() => {
    const items = computeStatusBreakdown(applications, isDemo ? [] : getPreferredResponseStatusOrder());
    const total = items.reduce((sum, item) => sum + item.count, 0);
    return items
      .map((item) => ({ ...item, percentage: total ? Math.round((item.count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [applications, isDemo]);
  const monthlyData = useMemo(() => {
    const grouped = new Map<string, { sortKey: string; label: string; count: number }>();
    applications.forEach((application) => {
      const date = safeDate(application.dateApplied);
      if (!date) return;
      const sortKey = format(date, "yyyy-MM");
      const current = grouped.get(sortKey);
      if (current) current.count += 1;
      else grouped.set(sortKey, { sortKey, label: format(date, "MMM yyyy"), count: 1 });
    });
    const orderedMonths = Array.from(grouped.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    // The chart range controls how much history is visible without changing source application data.
    return chartRange === "all" ? orderedMonths : orderedMonths.slice(-Number(chartRange));
  }, [applications, chartRange]);

  const recentActivity = useMemo(() => {
    const rows = applications.flatMap((application) => {
      if (application.activityLog?.length) {
        return application.activityLog.map((entry) => ({ application, date: safeDate(entry.date), message: entry.message }));
      }
      return [{ application, date: safeDate(application.dateApplied), message: `Applied to ${application.jobTitle} at ${application.companyName}` }];
    });
    return rows
      .filter((row): row is typeof row & { date: Date } => row.date !== null)
      .sort((a, b) => compareDesc(a.date, b.date))
      .slice(0, 5);
  }, [applications]);

  const upcomingFollowUps = useMemo(() => applications
    .filter((application) => Boolean(application.followUpDate) || isApplicationOverdue(application, now))
    .sort((a, b) => (a.followUpDate || "9999").localeCompare(b.followUpDate || "9999"))
    .slice(0, 5), [applications, now]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Overview of your job search progress."
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => setShowImport((current) => !current)}><Upload className="h-4 w-4" />Import Applications</Button>
            <Button size="sm" asChild><Link to="/app/add"><Plus className="h-4 w-4" />Add Application</Link></Button>
          </>
        )}
      />

      {showImport && onImportXLSX && (
        <section aria-label="Import applications" className="animate-in fade-in slide-in-from-top-1">
          <ExcelDropZone onImport={onImportXLSX} />
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6" aria-label="Job search summary">
        {metrics.map((metric) => (
          <div key={metric.label} className="app-panel flex min-h-24 items-center gap-3 p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${metric.tone}`}><metric.icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">{metric.value}</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{metric.label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="app-panel overflow-hidden" aria-labelledby="monthly-heading">
          <div className="app-panel-title flex items-center justify-between gap-3">
            <h2 id="monthly-heading">Applications Over Time</h2>
            <select
              aria-label="Applications chart range"
              value={chartRange}
              onChange={(event) => setChartRange(event.target.value as "3" | "6" | "12" | "all")}
              className="h-8 rounded-md border bg-background px-2 text-[10px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div className="p-4" role="img" aria-label="Monthly applications line graph">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 16, left: -18, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 6, borderColor: "hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="app-panel overflow-hidden" aria-labelledby="status-heading">
          <div className="app-panel-title"><h2 id="status-heading">Applications by Status</h2></div>
          {statusData.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">No status data yet.</p>
          ) : (
            <div className="grid items-center gap-3 p-4 sm:grid-cols-[minmax(210px,0.9fr)_minmax(220px,1.1fr)]">
              {/* The centered total mirrors the reference while the accessible label carries the full chart meaning. */}
              <div className="relative mx-auto h-[260px] w-full max-w-[280px]" role="img" aria-label={`Application status donut chart, ${applications.length} total applications`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={67} outerRadius={102} paddingAngle={1.5} stroke="hsl(var(--card))" strokeWidth={2}>
                      {statusData.map((item) => <Cell key={item.key} fill={getResponseStatusColor(item.key)} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Applications"]} contentStyle={{ borderRadius: 6, borderColor: "hsl(var(--border))", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tabular-nums">{applications.length}</span>
                  <span className="text-xs font-semibold text-muted-foreground">Total</span>
                </div>
              </div>
              <div className="space-y-1" role="list" aria-label="Application status breakdown">
                {statusData.map((item) => (
                  <Button
                    key={item.key}
                    variant="ghost"
                    className="h-9 w-full justify-start gap-3 rounded-md px-2 text-left"
                    onClick={() => navigate(`/app/applications?responseStatus=${encodeURIComponent(item.key)}`)}
                    aria-label={`View ${item.label} applications: ${item.count}, ${item.percentage}%`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getResponseStatusColor(item.key) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.count} ({item.percentage}%)</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_0.9fr]" aria-label="Application activity">
        <div className="app-panel overflow-hidden">
          <div className="app-panel-title"><h2>Recent Activity</h2></div>
          <div className="divide-y">
            {recentActivity.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No recent activity.</p> : recentActivity.map((item, index) => (
              <button key={`${item.application.id}-${item.date.toISOString()}-${index}`} type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => navigate(`/app/applications/${item.application.id}`)}>
                {/* Activity rows show the employer logo from the central service instead of a generic icon. */}<CompanyLogo companyName={item.application.companyName} jobLink={item.application.jobLink} companyDomain={item.application.companyDomain} companyLogoUrl={item.application.companyLogoUrl} className="mt-0.5" />
                <span className="min-w-0"><span className="block text-xs font-medium leading-5">{item.message}</span><span className="text-[10px] text-muted-foreground">{format(item.date, "MMM d, yyyy")}</span></span>
              </button>
            ))}
          </div>
          <Link to="/app/applications" className="block border-t px-4 py-3 text-xs font-semibold text-primary hover:bg-muted/40">View all activity →</Link>
        </div>

        <div className="app-panel overflow-hidden">
          <div className="app-panel-title"><h2>Upcoming Follow-ups</h2></div>
          <div className="divide-y">
            {upcomingFollowUps.length === 0 ? <p className="p-5 text-sm text-muted-foreground">You are all caught up.</p> : upcomingFollowUps.map((application) => (
              <button key={application.id} type="button" onClick={() => navigate(`/app/applications/${application.id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50">
                <span className="min-w-0"><span className="block truncate text-xs font-semibold">{application.companyName}</span><span className="block truncate text-[10px] text-muted-foreground">{application.jobTitle}</span></span>
                <span className="shrink-0 text-right"><span className="block text-[10px] font-medium">{application.followUpDate ? formatDisplayDate(application.followUpDate) : "Overdue"}</span><span className="text-[10px] text-amber-600">Follow up</span></span>
              </button>
            ))}
          </div>
          <Link to="/app/follow-ups" className="block border-t px-4 py-3 text-xs font-semibold text-primary hover:bg-muted/40">View all follow-ups →</Link>
        </div>

        <div className="space-y-4">
          <div className="app-panel overflow-hidden">
            <div className="app-panel-title"><h2>Quick Actions</h2></div>
            <div className="divide-y">
              {[
                { label: "Add Application", detail: "Add a new job", icon: Plus, action: () => navigate("/app/add") },
                { label: "Import XLSX", detail: "Merge workbook data", icon: FileSpreadsheet, action: () => setShowImport(true) },
                { label: "Export CSV", detail: "Download table data", icon: FileDown, action: () => exportCSV(applications) },
                { label: "Export XLSX", detail: "Download workbook", icon: Download, action: () => exportXLSX(applications) },
                { label: "AI & Analytics", detail: "Open guidance and trends", icon: BarChart3, action: () => navigate("/app/analytics") },
              ].map((item) => (
                <button key={item.label} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={item.action}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><item.icon className="h-3.5 w-3.5" /></span>
                  <span><span className="block text-xs font-semibold">{item.label}</span><span className="block text-[10px] text-muted-foreground">{item.detail}</span></span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-primary/15 bg-primary/5 p-3 text-[11px] leading-5 text-muted-foreground"><BellRing className="mr-1 inline h-3.5 w-3.5 text-primary" />Consistent tracking makes follow-ups easier and keeps opportunities from slipping through.</div>
        </div>
      </section>
    </div>
  );
}
