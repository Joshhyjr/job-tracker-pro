import { useMemo, useState } from "react";
import { Building2, Globe2, Laptop, MapPin } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { JobLocationsMap } from "@/components/JobLocationsMap";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { buildGeographySummary, parseJobLocation } from "@/lib/geography";
import type { JobApplication, WorkMode } from "@/lib/types";

type MapMode = "country" | "city";
type WorkModeFilter = "All" | WorkMode;

export default function Locations({ applications }: { applications: JobApplication[] }) {
  const [mapMode, setMapMode] = useState<MapMode>("country");
  const [workModeFilter, setWorkModeFilter] = useState<WorkModeFilter>("All");
  const stats = useMemo(() => buildGeographySummary(applications), [applications]);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const filteredApplications = useMemo(() => {
    if (workModeFilter === "All") return applications;
    // Work-mode filters use normalized metadata and never reinterpret the value as geography.
    return applications.filter((application) => parseJobLocation(application).workMode === workModeFilter);
  }, [applications, workModeFilter]);
  const filteredStats = useMemo(() => buildGeographySummary(filteredApplications), [filteredApplications]);
  const selectedCountry = filteredStats.countries.find((country) => country.code === selectedCountryCode) ?? filteredStats.countries[0];
  const selectedCities = selectedCountry
    ? filteredStats.cities.filter((city) => city.countryCode === selectedCountry.code)
    : [];
  const cityData = useMemo(() => filteredStats.cities.slice(0, 6).map((city) => ({ name: city.city, count: city.count })), [filteredStats.cities]);
  const mostActiveLocation = stats.countries[0];

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader title="Locations" description="Explore applications by normalized country, city, and work mode." />

      {/* Summary cards are derived from resolved records only; ambiguous locations are never fabricated. */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Location summary">
        {[
          { label: "Countries", value: stats.countries.length, icon: Globe2 },
          { label: "Cities", value: stats.cities.length, icon: Building2 },
          { label: "Remote roles", value: stats.remoteCount, icon: Laptop },
          { label: "Top location", value: mostActiveLocation?.name ?? "No data", icon: MapPin },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="app-panel flex items-center gap-3 p-4">
            <span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-background p-1" aria-label="Map layer">
          {(["country", "city"] as MapMode[]).map((mode) => (
            <Button key={mode} type="button" size="sm" variant={mapMode === mode ? "default" : "ghost"} onClick={() => setMapMode(mode)} className="h-8 capitalize">
              {mode} view
            </Button>
          ))}
        </div>
        <div className="flex max-w-full flex-wrap gap-1" aria-label="Work mode filter">
          {(["All", "On-site", "Hybrid", "Remote"] as WorkModeFilter[]).map((mode) => (
            <Button key={mode} type="button" size="sm" variant={workModeFilter === mode ? "secondary" : "ghost"} onClick={() => setWorkModeFilter(mode)} className="h-8">
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]" data-testid="locations-top-row">
        <section className="app-panel min-w-0 overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" />Applications by {mapMode === "country" ? "Country" : "City"}</div>
          <div className="p-3">
            <JobLocationsMap applications={filteredApplications} variant="summary" mode={mapMode} onCountrySelect={setSelectedCountryCode} />
          </div>
        </section>

        <section className="app-panel min-w-0 overflow-hidden">
          <div className="app-panel-title flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Top Countries</div>
          <div className="divide-y">
            {filteredStats.countries.slice(0, 7).map((country) => (
              <button key={country.code} type="button" onClick={() => setSelectedCountryCode(country.code)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs hover:bg-muted/50">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span aria-hidden="true" className="text-base leading-none">{country.flag}</span>
                  <span className="truncate">{country.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{country.count} ({country.percentage}%)</span>
              </button>
            ))}
          </div>
          {selectedCountry && (
            <div className="border-t bg-muted/20 p-4" aria-label={`${selectedCountry.name} location details`}>
              <p className="font-semibold">{selectedCountry.flag} {selectedCountry.name}</p>
              <p className="text-xs text-muted-foreground">{selectedCountry.count} application{selectedCountry.count === 1 ? "" : "s"}</p>
              {selectedCities.length > 0 && (
                <div className="mt-3 space-y-1.5 text-xs">
                  {selectedCities.slice(0, 6).map((city) => (
                    <div key={city.key} className="flex justify-between gap-3"><span className="truncate">{city.city}</span><span className="tabular-nums text-muted-foreground">{city.count}</span></div>
                  ))}
                </div>
              )}
              <a href={`/app/applications?country=${encodeURIComponent(selectedCountry.code)}`} className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">View applications</a>
            </div>
          )}
        </section>
      </div>

      <section className="app-panel min-w-0 overflow-hidden" aria-labelledby="city-chart-heading">
        <div className="app-panel-title flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><h2 id="city-chart-heading">Applications by City (Top 6)</h2></div>
        {cityData.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No resolved city data for this view.</p>
        ) : (
          <div className="h-[280px] min-w-0 px-3 pb-3 pt-5" role="img" aria-label="Applications by city bar chart">
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

      {stats.needsReviewCount > 0 && <p className="text-xs text-muted-foreground">{stats.needsReviewCount} application{stats.needsReviewCount === 1 ? "" : "s"} need location review and are excluded from geographic rankings.</p>}
    </div>
  );
}
