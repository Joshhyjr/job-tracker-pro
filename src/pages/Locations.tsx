import { useMemo } from "react";
import { Building2, Globe2, MapPin } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { JobLocationsMap } from "@/components/JobLocationsMap";
import PageHeader from "@/components/PageHeader";
import { getLocationEmoji } from "@/lib/locationEmoji";
import type { JobApplication } from "@/lib/types";

export default function Locations({ applications }: { applications: JobApplication[] }) {
  const stats = useMemo(() => {
    const countries = new Map<string, number>();
    const cities = new Map<string, number>();
    applications.forEach((application) => {
      const country = application.country || application.location.split(",").at(-1)?.trim() || "Unknown";
      const city = application.city || application.location.split(",")[0]?.trim() || "Unknown";
      countries.set(country, (countries.get(country) || 0) + 1);
      cities.set(city, (cities.get(city) || 0) + 1);
    });
    // Both cards and charts share one aggregation so their totals cannot drift apart.
    return {
      countries: [...countries.entries()].sort((a, b) => b[1] - a[1]),
      cities: [...cities.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [applications]);

  const cityData = useMemo(() => stats.cities.slice(0, 6).map(([name, count]) => ({ name, count })), [stats.cities]);

  return (
    <div className="space-y-5">
      <PageHeader title="Locations" description="Track your applications by location." />

      {/* The compact two-card row follows the supplied overview layout and stacks cleanly on smaller screens. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]" data-testid="locations-top-row">
        <section className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" />Applications by Country</div>
          <div className="p-3"><JobLocationsMap applications={applications} variant="summary" /></div>
        </section>

        <section className="app-panel overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Top Countries</div>
          <div className="divide-y">
            {stats.countries.slice(0, 7).map(([country, count]) => (
              <a key={country} href={`/app/applications?q=${encodeURIComponent(country)}`} className="flex items-center justify-between px-4 py-3 text-xs hover:bg-muted/50">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span aria-hidden="true" className="text-base leading-none">{getLocationEmoji(country)}</span>
                  <span className="truncate">{country}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{count} ({applications.length ? Math.round(count / applications.length * 100) : 0}%)</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      <section className="app-panel overflow-hidden" aria-labelledby="city-chart-heading">
        <div className="app-panel-title flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><h2 id="city-chart-heading">Applications by City (Top 6)</h2></div>
        {cityData.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No city data yet.</p>
        ) : (
          <div className="h-[280px] px-3 pb-3 pt-5" role="img" aria-label="Applications by city bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} margin={{ top: 16, right: 12, left: -18, bottom: 2 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.35)" }} contentStyle={{ borderRadius: 6, borderColor: "hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="count" name="Applications" fill="hsl(var(--primary))" maxBarSize={52} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" className="fill-foreground text-[11px] font-semibold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
