import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, CalendarDays, Clock, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { JobApplication, CurrentStatus } from "@/lib/types";
import { CURRENT_STATUSES } from "@/lib/types";
import { isAfter, isBefore, subDays, startOfWeek, startOfMonth, parseISO, format, isValid } from "date-fns";

const PIE_COLORS = [
  "hsl(213,94%,55%)", "hsl(271,76%,53%)", "hsl(142,71%,45%)",
  "hsl(0,84%,60%)", "hsl(38,92%,50%)", "hsl(215,16%,47%)",
];

function safeParseDate(d: string) {
  if (!d) return null;
  const p = parseISO(d);
  return isValid(p) ? p : null;
}

export default function Dashboard({ applications }: { applications: JobApplication[] }) {
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const stats = useMemo(() => {
    let thisWeek = 0, thisMonth = 0, overdue = 0;
    const statusCounts: Record<CurrentStatus, number> = { Applied: 0, Interview: 0, Offer: 0, Rejected: 0, "No Response": 0, Withdrawn: 0 };

    applications.forEach((a) => {
      statusCounts[a.currentStatus] = (statusCounts[a.currentStatus] || 0) + 1;
      const d = safeParseDate(a.dateApplied);
      if (d) {
        if (!isBefore(d, weekStart)) thisWeek++;
        if (!isBefore(d, monthStart)) thisMonth++;
      }
      // Overdue: applied/no-response > 7 days ago, no follow-up
      if (["Applied", "No Response"].includes(a.currentStatus) && !a.followUps) {
        const da = safeParseDate(a.dateApplied);
        if (da && isAfter(subDays(now, 7), da)) overdue++;
      }
      // Or follow-up date is past
      const fud = safeParseDate(a.followUpDate);
      if (fud && isAfter(now, fud) && ["Applied", "No Response"].includes(a.currentStatus)) overdue++;
    });

    return { total: applications.length, thisWeek, thisMonth, overdue, statusCounts };
  }, [applications]);

  const pieData = CURRENT_STATUSES.map((s, i) => ({ name: s, value: stats.statusCounts[s], color: PIE_COLORS[i] })).filter((d) => d.value > 0);

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

  const metrics = [
    { label: "Total", value: stats.total, icon: Briefcase, color: "text-[hsl(var(--status-applied))]" },
    { label: "This Week", value: stats.thisWeek, icon: CalendarDays, color: "text-[hsl(var(--status-interview))]" },
    { label: "This Month", value: stats.thisMonth, icon: Clock, color: "text-[hsl(var(--status-offer))]" },
    { label: "Overdue Follow-ups", value: stats.overdue, icon: AlertTriangle, color: "text-[hsl(var(--status-rejected))]" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2">
                {CURRENT_STATUSES.map((s, i) => (
                  <Button key={s} variant="ghost" size="sm" className="justify-start gap-2 text-xs" onClick={() => navigate(`/applications?status=${encodeURIComponent(s)}`)}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                    {s} ({stats.statusCounts[s]})
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Applications</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barSize={40} barCategoryGap="20%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
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
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    return (
                      <div className="rounded-md border border-border/50 bg-popover px-3 py-1.5 text-xs shadow-sm">
                        <p className="font-medium text-popover-foreground">{label}</p>
                        <p className="text-muted-foreground">{payload[0].value} applications</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="hsl(213,94%,55%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
