import type { JobApplication } from "./types";

export type LocationResolutionSource = "coordinates" | "city" | "local-city" | "local-region" | "country";

export interface JobLocationGroup {
  key: string;
  city: string;
  region: string;
  country: string;
  label: string;
  latitude: number;
  longitude: number;
  applications: JobApplication[];
  source: LocationResolutionSource;
}

export interface JobLocationGroupsResult {
  groups: JobLocationGroup[];
  unresolved: JobApplication[];
  ignored: JobApplication[];
}

const MAP_CENTER_LONGITUDE = 10;
const LOCATION_CACHE_KEY = "job-tracker-location-coordinate-cache-v2";

type CoordinateResolution = {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  source: LocationResolutionSource;
};

type CachedCoordinate = Pick<CoordinateResolution, "latitude" | "longitude" | "city" | "country">;

type WorldCityRecord = {
  city: string;
  cityAscii: string;
  latitude: number;
  longitude: number;
  country: string;
  adminName: string;
  iso2: string;
  iso3: string;
  population: number;
};

export type WorldCityIndex = {
  cityCountry: Map<string, CachedCoordinate>;
  cityRegionCountry: Map<string, CachedCoordinate>;
  regionCountry: Map<string, CachedCoordinate>;
  countryAliases: Map<string, string>;
};

type LocationQuery = {
  city?: string;
  region?: string;
  country: string;
};

export type CityCoordinateResolver = (query: LocationQuery) => Promise<CachedCoordinate | null> | CachedCoordinate | null;

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number; city: string; country: string }> = {
  "amsterdam|netherlands": { latitude: 52.3676, longitude: 4.9041, city: "Amsterdam", country: "Netherlands" },
  "atlanta|united states": { latitude: 33.749, longitude: -84.388, city: "Atlanta", country: "United States" },
  "austin|united states": { latitude: 30.2672, longitude: -97.7431, city: "Austin", country: "United States" },
  "berlin|germany": { latitude: 52.52, longitude: 13.405, city: "Berlin", country: "Germany" },
  "boston|united states": { latitude: 42.3601, longitude: -71.0589, city: "Boston", country: "United States" },
  "chicago|united states": { latitude: 41.8781, longitude: -87.6298, city: "Chicago", country: "United States" },
  "dublin|ireland": { latitude: 53.3498, longitude: -6.2603, city: "Dublin", country: "Ireland" },
  "halifax|canada": { latitude: 44.6488, longitude: -63.5752, city: "Halifax", country: "Canada" },
  "lisbon|portugal": { latitude: 38.7223, longitude: -9.1393, city: "Lisbon", country: "Portugal" },
  "london|united kingdom": { latitude: 51.5072, longitude: -0.1276, city: "London", country: "United Kingdom" },
  "los angeles|united states": { latitude: 34.0522, longitude: -118.2437, city: "Los Angeles", country: "United States" },
  "madrid|spain": { latitude: 40.4168, longitude: -3.7038, city: "Madrid", country: "Spain" },
  "melbourne|australia": { latitude: -37.8136, longitude: 144.9631, city: "Melbourne", country: "Australia" },
  "montreal|canada": { latitude: 45.5019, longitude: -73.5674, city: "Montreal", country: "Canada" },
  "new york|united states": { latitude: 40.7128, longitude: -74.006, city: "New York", country: "United States" },
  "paris|france": { latitude: 48.8566, longitude: 2.3522, city: "Paris", country: "France" },
  "san francisco|united states": { latitude: 37.7749, longitude: -122.4194, city: "San Francisco", country: "United States" },
  "seattle|united states": { latitude: 47.6061, longitude: -122.3328, city: "Seattle", country: "United States" },
  "singapore|singapore": { latitude: 1.3521, longitude: 103.8198, city: "Singapore", country: "Singapore" },
  "sydney|australia": { latitude: -33.8688, longitude: 151.2093, city: "Sydney", country: "Australia" },
  "tokyo|japan": { latitude: 35.6762, longitude: 139.6503, city: "Tokyo", country: "Japan" },
  "toronto|canada": { latitude: 43.6532, longitude: -79.3832, city: "Toronto", country: "Canada" },
  "vancouver|canada": { latitude: 49.2827, longitude: -123.1207, city: "Vancouver", country: "Canada" },
  "washington|united states": { latitude: 38.9072, longitude: -77.0369, city: "Washington", country: "United States" },
};

const COUNTRY_COORDINATES: Record<string, { latitude: number; longitude: number; country: string }> = {
  argentina: { latitude: -38.4161, longitude: -63.6167, country: "Argentina" },
  australia: { latitude: -25.2744, longitude: 133.7751, country: "Australia" },
  belgium: { latitude: 50.5039, longitude: 4.4699, country: "Belgium" },
  brazil: { latitude: -14.235, longitude: -51.9253, country: "Brazil" },
  canada: { latitude: 56.1304, longitude: -106.3468, country: "Canada" },
  china: { latitude: 35.8617, longitude: 104.1954, country: "China" },
  "costa rica": { latitude: 9.7489, longitude: -83.7534, country: "Costa Rica" },
  france: { latitude: 46.2276, longitude: 2.2137, country: "France" },
  germany: { latitude: 51.1657, longitude: 10.4515, country: "Germany" },
  india: { latitude: 20.5937, longitude: 78.9629, country: "India" },
  ireland: { latitude: 53.4129, longitude: -8.2439, country: "Ireland" },
  italy: { latitude: 41.8719, longitude: 12.5674, country: "Italy" },
  japan: { latitude: 36.2048, longitude: 138.2529, country: "Japan" },
  mexico: { latitude: 23.6345, longitude: -102.5528, country: "Mexico" },
  netherlands: { latitude: 52.1326, longitude: 5.2913, country: "Netherlands" },
  portugal: { latitude: 39.3999, longitude: -8.2245, country: "Portugal" },
  singapore: { latitude: 1.3521, longitude: 103.8198, country: "Singapore" },
  "south africa": { latitude: -30.5595, longitude: 22.9375, country: "South Africa" },
  spain: { latitude: 40.4637, longitude: -3.7492, country: "Spain" },
  switzerland: { latitude: 46.8182, longitude: 8.2275, country: "Switzerland" },
  "united kingdom": { latitude: 55.3781, longitude: -3.436, country: "United Kingdom" },
  "united states": { latitude: 39.8283, longitude: -98.5795, country: "United States" },
};

const COUNTRY_ALIASES: Record<string, string> = {
  ae: "united arab emirates",
  america: "united states",
  are: "united arab emirates",
  aus: "australia",
  ca: "canada",
  deutschland: "germany",
  england: "united kingdom",
  "great britain": "united kingdom",
  "the netherlands": "netherlands",
  "united arab emirates": "united arab emirates",
  uk: "united kingdom",
  uae: "united arab emirates",
  "u a e": "united arab emirates",
  emirates: "united arab emirates",
  usa: "united states",
  us: "united states",
  "u.s": "united states",
  "u.s.a": "united states",
};

function normalizeLocationPart(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLookupKey(value: unknown): string {
  return normalizeLocationPart(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCountryKey(value: unknown, aliases?: Map<string, string>): string {
  const key = normalizeLookupKey(value);
  return aliases?.get(key) ?? COUNTRY_ALIASES[key] ?? key;
}

function parseCoordinate(value: unknown, min: number, max: number): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function splitLocation(location: string): { city: string; region: string; country: string } {
  const parts = location.split(",").map(normalizeLocationPart).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], region: parts.slice(1, -1).join(", "), country: parts[parts.length - 1] };
  if (parts.length === 2) return { city: parts[0], region: "", country: parts[1] };
  return { city: "", region: "", country: parts[0] ?? "" };
}

function isRemoteOrBlankApplication(application: JobApplication): boolean {
  const latitude = parseCoordinate(application.latitude, -90, 90);
  const longitude = parseCoordinate(application.longitude, -180, 180);
  if (latitude !== undefined && longitude !== undefined) return false;

  const place = getApplicationPlace(application);
  const locationText = normalizeLocationPart(application.location);
  const searchable = [locationText, place.city, place.region, place.country].filter(Boolean).join(" ");

  // Remote and blank jobs are valid applications, but they should not create pins or cleanup noise.
  return !searchable || /\b(remote|blank|n\/a|na|none|tbd|various|multiple)\b/i.test(searchable);
}

function getApplicationPlace(application: JobApplication): { city: string; region: string; country: string } {
  const fromLocation = splitLocation(application.location);
  const hasStructuredLocationText = application.location.split(",").map(normalizeLocationPart).filter(Boolean).length >= 2;

  if (hasStructuredLocationText) {
    return {
      city: fromLocation.city,
      region: fromLocation.region,
      country: fromLocation.country || normalizeLocationPart(application.country),
    };
  }

  return {
    city: normalizeLocationPart(application.city) || fromLocation.city,
    region: normalizeLocationPart(application.region) || fromLocation.region,
    country: normalizeLocationPart(application.country) || fromLocation.country,
  };
}

export function getApplicationLocationLabel(application: JobApplication): string {
  const place = getApplicationPlace(application);
  return [place.city, place.region, place.country].filter(Boolean).join(", ") || normalizeLocationPart(application.location) || "No location";
}

function getCachedCoordinates(cacheKey: string): CachedCoordinate | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || "{}") as Record<string, CachedCoordinate>;
    return parsed[cacheKey] ?? null;
  } catch {
    return null;
  }
}

function setCachedCoordinates(cacheKey: string, coordinates: CachedCoordinate) {
  if (typeof localStorage === "undefined") return;
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || "{}") as Record<string, CachedCoordinate>;
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...parsed, [cacheKey]: coordinates }));
  } catch {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ [cacheKey]: coordinates }));
  }
}

function getCoordinateCacheKey(query: LocationQuery, countryAliases?: Map<string, string>): string {
  return [
    normalizeLookupKey(query.city),
    normalizeLookupKey(query.region),
    normalizeCountryKey(query.country, countryAliases),
  ].join("|");
}

function getCoordinateResolution(application: JobApplication): CoordinateResolution | null {
  const latitude = parseCoordinate(application.latitude, -90, 90);
  const longitude = parseCoordinate(application.longitude, -180, 180);
  const place = getApplicationPlace(application);
  const countryKey = normalizeCountryKey(place.country);
  const cityKey = `${normalizeLookupKey(place.city)}|${countryKey}`;

  if (latitude !== undefined && longitude !== undefined) {
    return { ...place, latitude, longitude, source: "coordinates" as const };
  }

  if (place.city && !place.region && CITY_COORDINATES[cityKey]) {
    return { ...CITY_COORDINATES[cityKey], region: "", source: "city" as const };
  }

  if (!place.city && !place.region && countryKey && COUNTRY_COORDINATES[countryKey]) {
    const country = COUNTRY_COORDINATES[countryKey];
    return { city: "", region: "", country: country.country, latitude: country.latitude, longitude: country.longitude, source: "country" as const };
  }

  return null;
}

function getLocationQueries(place: { city: string; region: string; country: string }): LocationQuery[] {
  const queries: LocationQuery[] = [];

  if (place.city && place.region) queries.push({ city: place.city, region: place.region, country: place.country });
  if (place.city) queries.push({ city: place.city, country: place.country });
  if (place.region) queries.push({ region: place.region, country: place.country });
  // Two-part locations are ambiguous: try city first, then region, so "Dubai, UAE" and "Ontario, Canada" both work.
  if (place.city && !place.region) queries.push({ region: place.city, country: place.country });
  if (!place.city && !place.region) queries.push({ country: place.country });

  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = getCoordinateCacheKey(query);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getCoordinateResolutionAsync(application: JobApplication, resolver: CityCoordinateResolver): Promise<CoordinateResolution | null> {
  const existingResolution = getCoordinateResolution(application);
  if (existingResolution) return existingResolution;

  const place = getApplicationPlace(application);
  if (!place.country) return null;
  const countryKey = normalizeCountryKey(place.country);

  const queries = getLocationQueries(place);

  for (const query of queries) {
    const cacheKey = getCoordinateCacheKey(query);
    const cached = getCachedCoordinates(cacheKey);
    if (cached) return { ...cached, source: cached.region ? "local-region" : "local-city" };

    const resolved = await resolver(query);
    if (resolved) {
      const source: LocationResolutionSource = resolved.region && !resolved.city ? "local-region" : "local-city";
      setCachedCoordinates(cacheKey, resolved);
      return { ...resolved, city: resolved.city ?? "", region: resolved.region ?? "", source };
    }
  }

  if (countryKey && COUNTRY_COORDINATES[countryKey]) {
    const country = COUNTRY_COORDINATES[countryKey];
    return { city: "", region: "", country: country.country, latitude: country.latitude, longitude: country.longitude, source: "country" as const };
  }

  return null;
}

function getGroupKey(resolution: CoordinateResolution): string {
  // Rounding coordinate-provided keys keeps tiny spreadsheet precision differences grouped together.
  const lat = resolution.latitude.toFixed(3);
  const lng = resolution.longitude.toFixed(3);
  return `${normalizeLookupKey(resolution.city)}|${normalizeLookupKey(resolution.region)}|${normalizeCountryKey(resolution.country)}|${lat}|${lng}`;
}

export function projectGeoPoint(latitude: number, longitude: number): { x: number; y: number } {
  // The Natural Earth map asset is centered at 10E, so longitudes are wrapped to that equirectangular frame.
  const wrappedLongitude = ((((longitude - MAP_CENTER_LONGITUDE) + 180) % 360) + 360) % 360;
  return {
    x: (wrappedLongitude / 360) * 100,
    y: ((90 - latitude) / 180) * 100,
  };
}

function addApplicationToLocationGroup(grouped: Map<string, JobLocationGroup>, application: JobApplication, resolution: CoordinateResolution) {
  const key = getGroupKey(resolution);
  const originalLabel = getApplicationLocationLabel(application);
  const fallbackLabel = [resolution.city, resolution.region, resolution.country].filter(Boolean).join(", ") || application.location;
  const existing = grouped.get(key);

  if (existing) {
    existing.applications.push(application);
    return;
  }

  grouped.set(key, {
    key,
    city: resolution.city,
    region: resolution.region,
    country: resolution.country,
    label: originalLabel === "No location" ? fallbackLabel : originalLabel,
    latitude: resolution.latitude,
    longitude: resolution.longitude,
    applications: [application],
    source: resolution.source,
  });
}

function sortLocationGroups(grouped: Map<string, JobLocationGroup>): JobLocationGroup[] {
  return Array.from(grouped.values()).sort((a, b) => b.applications.length - a.applications.length || a.label.localeCompare(b.label));
}

export function buildJobLocationGroups(applications: JobApplication[]): JobLocationGroupsResult {
  const grouped = new Map<string, JobLocationGroup>();
  const unresolved: JobApplication[] = [];
  const ignored: JobApplication[] = [];

  applications.forEach((application) => {
    if (isRemoteOrBlankApplication(application)) {
      ignored.push(application);
      return;
    }

    const resolution = getCoordinateResolution(application);
    if (!resolution) {
      unresolved.push(application);
      return;
    }

    addApplicationToLocationGroup(grouped, application, resolution);
  });

  return {
    groups: sortLocationGroups(grouped),
    unresolved,
    ignored,
  };
}

export async function buildJobLocationGroupsAsync(applications: JobApplication[], resolver: CityCoordinateResolver = resolveCityCountryFromWorldCities): Promise<JobLocationGroupsResult> {
  const grouped = new Map<string, JobLocationGroup>();
  const unresolved: JobApplication[] = [];
  const ignored: JobApplication[] = [];
  const requestCache = new Map<string, Promise<CachedCoordinate | null>>();

  for (const application of applications) {
    if (isRemoteOrBlankApplication(application)) {
      ignored.push(application);
      continue;
    }

    const cachedResolver: CityCoordinateResolver = (query) => {
      const key = getCoordinateCacheKey(query);
      if (!requestCache.has(key)) requestCache.set(key, Promise.resolve(resolver(query)));
      return requestCache.get(key) ?? null;
    };
    const resolution = await getCoordinateResolutionAsync(application, cachedResolver);
    if (!resolution) {
      unresolved.push(application);
      continue;
    }

    addApplicationToLocationGroup(grouped, application, resolution);
  }

  return {
    groups: sortLocationGroups(grouped),
    unresolved,
    ignored,
  };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      current += "\"";
      index++;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseWorldCitiesCsv(csv: string): WorldCityRecord[] {
  const [headerLine, ...lines] = csv.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);
  const column = (name: string) => headers.indexOf(name);
  const cityIndex = column("city");
  const cityAsciiIndex = column("city_ascii");
  const latIndex = column("lat");
  const lngIndex = column("lng");
  const countryIndex = column("country");
  const adminNameIndex = column("admin_name");
  const iso2Index = column("iso2");
  const iso3Index = column("iso3");
  const populationIndex = column("population");

  return lines.flatMap((line) => {
    const values = parseCsvLine(line);
    const latitude = Number(values[latIndex]);
    const longitude = Number(values[lngIndex]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    return [{
      city: values[cityIndex] || values[cityAsciiIndex] || "",
      cityAscii: values[cityAsciiIndex] || values[cityIndex] || "",
      latitude,
      longitude,
      country: values[countryIndex] || "",
      adminName: values[adminNameIndex] || "",
      iso2: values[iso2Index] || "",
      iso3: values[iso3Index] || "",
      population: Number(values[populationIndex]) || 0,
    }];
  });
}

export function createWorldCityIndex(records: WorldCityRecord[]): WorldCityIndex {
  const cityCountry = new Map<string, CachedCoordinate & { population: number }>();
  const cityRegionCountry = new Map<string, CachedCoordinate & { population: number }>();
  const regionTotals = new Map<string, { region: string; country: string; latitudeTotal: number; longitudeTotal: number; weightTotal: number; count: number }>();
  const countryAliases = new Map<string, string>();

  records.forEach((record) => {
    const countryKey = normalizeLookupKey(record.country);
    const regionKey = normalizeLookupKey(record.adminName);
    if (!record.city || !countryKey) return;

    [record.country, record.iso2, record.iso3].forEach((alias) => {
      const normalizedAlias = normalizeLookupKey(alias);
      if (normalizedAlias) countryAliases.set(normalizedAlias, countryKey);
    });

    const coordinate = {
      city: record.city,
      region: record.adminName,
      country: record.country,
      latitude: record.latitude,
      longitude: record.longitude,
      population: record.population,
    };

    [record.city, record.cityAscii].forEach((cityName) => {
      const cityKey = normalizeLookupKey(cityName);
      if (!cityKey) return;
      const key = `${cityKey}|${countryKey}`;
      const existing = cityCountry.get(key);
      if (!existing || coordinate.population > existing.population) cityCountry.set(key, coordinate);

      if (regionKey) {
        const regionalKey = `${cityKey}|${regionKey}|${countryKey}`;
        const existingRegional = cityRegionCountry.get(regionalKey);
        if (!existingRegional || coordinate.population > existingRegional.population) cityRegionCountry.set(regionalKey, coordinate);
      }
    });

    if (regionKey) {
      const key = `${regionKey}|${countryKey}`;
      const weight = record.population > 0 ? record.population : 1;
      const existing = regionTotals.get(key);
      if (existing) {
        existing.latitudeTotal += record.latitude * weight;
        existing.longitudeTotal += record.longitude * weight;
        existing.weightTotal += weight;
        existing.count += 1;
      } else {
        regionTotals.set(key, {
          region: record.adminName,
          country: record.country,
          latitudeTotal: record.latitude * weight,
          longitudeTotal: record.longitude * weight,
          weightTotal: weight,
          count: 1,
        });
      }
    }
  });

  Object.entries(COUNTRY_ALIASES).forEach(([alias, country]) => countryAliases.set(normalizeLookupKey(alias), normalizeLookupKey(country)));

  return {
    cityCountry: new Map(Array.from(cityCountry.entries()).map(([key, value]) => [key, {
      city: value.city,
      region: value.region,
      country: value.country,
      latitude: value.latitude,
      longitude: value.longitude,
    }])),
    cityRegionCountry: new Map(Array.from(cityRegionCountry.entries()).map(([key, value]) => [key, {
      city: value.city,
      region: value.region,
      country: value.country,
      latitude: value.latitude,
      longitude: value.longitude,
    }])),
    regionCountry: new Map(Array.from(regionTotals.entries()).map(([key, value]) => [key, {
      city: "",
      region: value.region,
      country: value.country,
      latitude: value.latitudeTotal / value.weightTotal,
      longitude: value.longitudeTotal / value.weightTotal,
    }])),
    countryAliases,
  };
}

export function resolveCityCountryFromIndex(index: WorldCityIndex, queryOrCity: LocationQuery | string, countryValue?: string): CachedCoordinate | null {
  const query: LocationQuery = typeof queryOrCity === "string"
    ? { city: queryOrCity, country: countryValue ?? "" }
    : queryOrCity;
  const cityKey = normalizeLookupKey(query.city);
  const regionKey = normalizeLookupKey(query.region);
  const countryKey = normalizeCountryKey(query.country, index.countryAliases);
  if (!countryKey) return null;

  if (cityKey && regionKey) {
    const cityRegionMatch = index.cityRegionCountry.get(`${cityKey}|${regionKey}|${countryKey}`);
    if (cityRegionMatch) return cityRegionMatch;
  }

  if (cityKey) {
    const cityMatch = index.cityCountry.get(`${cityKey}|${countryKey}`);
    if (cityMatch) return cityMatch;
  }

  if (regionKey) {
    const regionMatch = index.regionCountry.get(`${regionKey}|${countryKey}`);
    if (regionMatch) return regionMatch;
  }

  return null;
}

let worldCityIndexPromise: Promise<WorldCityIndex> | null = null;

async function loadWorldCityIndex(): Promise<WorldCityIndex> {
  if (!worldCityIndexPromise) {
    worldCityIndexPromise = fetch("/worldcities.csv")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load local city coordinate database.");
        return response.text();
      })
      .then((csv) => createWorldCityIndex(parseWorldCitiesCsv(csv)));
  }
  return worldCityIndexPromise;
}

export async function resolveCityCountryFromWorldCities(query: LocationQuery): Promise<CachedCoordinate | null> {
  const index = await loadWorldCityIndex();
  return resolveCityCountryFromIndex(index, query);
}
