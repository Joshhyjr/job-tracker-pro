import { beforeEach, describe, expect, it } from "vitest";
import { buildJobLocationGroups, buildJobLocationGroupsAsync, createWorldCityIndex, parseWorldCitiesCsv, projectGeoPoint, resolveCityCountryFromIndex } from "@/lib/locations";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication>): JobApplication {
  return {
    id: overrides.id ?? Math.random().toString(36),
    jobTitle: overrides.jobTitle ?? "Engineer",
    companyName: overrides.companyName ?? "Acme",
    location: overrides.location ?? "",
    currentStatus: overrides.currentStatus ?? "Applied",
    responseStatus: overrides.responseStatus ?? "Applied",
    followUps: overrides.followUps ?? false,
    dateApplied: overrides.dateApplied ?? "",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    activityLog: overrides.activityLog ?? [],
    ...overrides,
  };
}

describe("job location grouping", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("groups multiple applications in the same parsed city and country", () => {
    const result = buildJobLocationGroups([
      application({ id: "1", city: "Toronto", country: "Canada", companyName: "Northstar" }),
      application({ id: "2", location: "Toronto, CA", companyName: "Harbor" }),
    ]);

    expect(result.unresolved).toHaveLength(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      label: "Toronto, Canada",
      source: "city",
      applications: expect.arrayContaining([expect.objectContaining({ companyName: "Northstar" }), expect.objectContaining({ companyName: "Harbor" })]),
    });
  });

  it("uses explicit coordinates before local city or country lookup", () => {
    const result = buildJobLocationGroups([
      application({ city: "Unknown", country: "Unknown", latitude: 10.5, longitude: -20.25 }),
    ]);

    expect(result.groups[0]).toMatchObject({
      latitude: 10.5,
      longitude: -20.25,
      source: "coordinates",
    });
  });

  it("ignores remote and blank applications without flagging them for cleanup", () => {
    const result = buildJobLocationGroups([
      application({ id: "remote", location: "Remote" }),
      application({ id: "blank", location: "" }),
    ]);

    expect(result.groups).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.ignored.map((item) => item.id)).toEqual(["remote", "blank"]);
  });

  it("returns unresolved applications with non-remote invalid location data", () => {
    const result = buildJobLocationGroups([
      application({ id: "typo", location: "Canadaa" }),
    ]);

    expect(result.groups).toEqual([]);
    expect(result.ignored).toEqual([]);
    expect(result.unresolved[0].id).toBe("typo");
  });

  it("projects latitude and longitude into map percentages", () => {
    expect(projectGeoPoint(0, 10)).toEqual({ x: 50, y: 50 });
    expect(projectGeoPoint(90, -170)).toEqual({ x: 0, y: 0 });
  });

  it("resolves city and country pairs from a local world cities index", () => {
    const index = createWorldCityIndex(parseWorldCitiesCsv([
      '"city","city_ascii","lat","lng","country","iso2","iso3","admin_name","capital","population","id"',
      '"Zagreb","Zagreb","45.8000","16.0000","Croatia","HR","HRV","Zagreb","primary","685000","119123"',
      '"Dubai","Dubai","25.2631","55.2972","United Arab Emirates","AE","ARE","Dubayy","admin","3331000","178473"',
    ].join("\n")));

    expect(resolveCityCountryFromIndex(index, "Zagreb", "Croatia")).toMatchObject({
      latitude: 45.8,
      longitude: 16,
      country: "Croatia",
    });
    expect(resolveCityCountryFromIndex(index, "Dubai", "UAE")).toMatchObject({
      latitude: 25.2631,
      longitude: 55.2972,
      country: "United Arab Emirates",
    });
  });

  it("resolves city, region, and country before broader fallbacks", () => {
    const index = createWorldCityIndex(parseWorldCitiesCsv([
      '"city","city_ascii","lat","lng","country","iso2","iso3","admin_name","capital","population","id"',
      '"Woodstock","Woodstock","43.1300","-80.7500","Canada","CA","CAN","Ontario","","46000","1"',
      '"Woodstock","Woodstock","46.1500","-67.5700","Canada","CA","CAN","New Brunswick","","5000","2"',
    ].join("\n")));

    expect(resolveCityCountryFromIndex(index, { city: "Woodstock", region: "Ontario", country: "Canada" })).toMatchObject({
      latitude: 43.13,
      longitude: -80.75,
      region: "Ontario",
    });
  });

  it("resolves province and country when city is missing", async () => {
    const index = createWorldCityIndex(parseWorldCitiesCsv([
      '"city","city_ascii","lat","lng","country","iso2","iso3","admin_name","capital","population","id"',
      '"Toronto","Toronto","43.6532","-79.3832","Canada","CA","CAN","Ontario","admin","2930000","1"',
      '"Ottawa","Ottawa","45.4200","-75.7000","Canada","CA","CAN","Ontario","primary","1017000","2"',
      '"Vancouver","Vancouver","49.2500","-123.1000","Canada","CA","CAN","British Columbia","","675218","3"',
    ].join("\n")));

    const result = await buildJobLocationGroupsAsync(
      [application({ location: "Ontario, Canada", companyName: "Forvan Tech" })],
      (query) => resolveCityCountryFromIndex(index, query),
    );

    expect(result.unresolved).toEqual([]);
    expect(result.groups[0]).toMatchObject({
      label: "Ontario, Canada",
      region: "Ontario",
      source: "local-region",
    });
  });

  it("uses a city-country resolver to pin locations not in the manual list", async () => {
    const result = await buildJobLocationGroupsAsync(
      [application({ city: "Zagreb", country: "Croatia", companyName: "Studio" })],
      () => ({ city: "Zagreb", region: "", country: "Croatia", latitude: 45.8, longitude: 16 }),
    );

    expect(result.unresolved).toEqual([]);
    expect(result.groups[0]).toMatchObject({
      label: "Zagreb, Croatia",
      latitude: 45.8,
      longitude: 16,
      source: "local-city",
    });
  });

  it("does not reuse stale cached coordinates after location text changes", async () => {
    const first = await buildJobLocationGroupsAsync(
      [application({ id: "forvan", companyName: "Forvan Tech", location: "Woodstock, Ontario, Canada" })],
      () => ({ city: "Woodstock", region: "Ontario", country: "Canada", latitude: 43.13, longitude: -80.75 }),
    );
    const second = await buildJobLocationGroupsAsync(
      [application({ id: "forvan", companyName: "Forvan Tech", location: "Ontario, Canada" })],
      (query) => {
        if (query.region === "Ontario") return { city: "", region: "Ontario", country: "Canada", latitude: 44.3, longitude: -79.8 };
        return null;
      },
    );

    expect(first.groups[0]).toMatchObject({ label: "Woodstock, Ontario, Canada", latitude: 43.13 });
    expect(second.groups[0]).toMatchObject({ label: "Ontario, Canada", latitude: 44.3, source: "local-region" });
  });

  it("re-parses updated location text instead of stale structured fields", async () => {
    const result = await buildJobLocationGroupsAsync(
      [application({
        id: "forvan",
        companyName: "Forvan Tech",
        location: "Ontario, Canada",
        city: "Woodstock",
        region: "Ontario",
        country: "Canada",
      })],
      (query) => {
        if (query.region === "Ontario" && !query.city) return { city: "", region: "Ontario", country: "Canada", latitude: 44.3, longitude: -79.8 };
        return null;
      },
    );

    expect(result.groups[0]).toMatchObject({
      label: "Ontario, Canada",
      city: "",
      region: "Ontario",
      latitude: 44.3,
    });
  });
});
