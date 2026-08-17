import type { JobApplication, LocationStatus, WorkMode } from "./types";

export interface ParsedJobLocation {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  workMode?: WorkMode;
  locationStatus: LocationStatus;
}

export interface CountryLocationSummary {
  code: string;
  iso3: string;
  name: string;
  flag: string;
  count: number;
  percentage: number;
  applications: JobApplication[];
}

export interface CityLocationSummary {
  key: string;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  count: number;
  applications: JobApplication[];
}

export interface GeographySummary {
  countries: CountryLocationSummary[];
  cities: CityLocationSummary[];
  remoteCount: number;
  needsReviewCount: number;
}

// Spreadsheet templates use several labels for the same work-mode field; keep them centralized for import and legacy-data recovery.
export const WORK_MODE_SPREADSHEET_HEADERS = [
  "Work Mode",
  "Work Arrangement",
  "Working Arrangement",
  "Work Type",
  "Work Model",
  "Working Model",
  "Workplace Type",
  "Workplace Model",
  "Work Location Type",
  "Location Type",
  "Remote Status",
  "Remote/Hybrid/On-site",
  "Remote/Hybrid/Onsite",
  "On-site/Remote",
  "Onsite/Remote",
] as const;

// ISO alpha-2 is the persisted key; alpha-3 bridges application data to Natural Earth boundaries.
const COUNTRY_CODE_TO_ISO3: Record<string, string> = {
  "AQ": "ATA",
  "AX": "ALA",
  "AD": "AND",
  "AE": "ARE",
  "AF": "AFG",
  "AG": "ATG",
  "AI": "AIA",
  "AL": "ALB",
  "AM": "ARM",
  "AO": "AGO",
  "AR": "ARG",
  "AS": "ASM",
  "AT": "AUT",
  "AU": "AUS",
  "AW": "ABW",
  "AZ": "AZE",
  "BA": "BIH",
  "BB": "BRB",
  "BD": "BGD",
  "BE": "BEL",
  "BF": "BFA",
  "BG": "BGR",
  "BH": "BHR",
  "BI": "BDI",
  "BJ": "BEN",
  "BL": "BLM",
  "BM": "BMU",
  "BN": "BRN",
  "BO": "BOL",
  "BQ": "BES",
  "BR": "BRA",
  "BV": "BVT",
  "BS": "BHS",
  "BT": "BTN",
  "BW": "BWA",
  "BY": "BLR",
  "BZ": "BLZ",
  "CA": "CAN",
  "CC": "CCK",
  "CD": "COD",
  "CF": "CAF",
  "CG": "COG",
  "CH": "CHE",
  "CI": "CIV",
  "CK": "COK",
  "CL": "CHL",
  "CM": "CMR",
  "CN": "CHN",
  "CO": "COL",
  "CR": "CRI",
  "CU": "CUB",
  "CV": "CPV",
  "CW": "CUW",
  "CX": "CXR",
  "CY": "CYP",
  "CZ": "CZE",
  "DE": "DEU",
  "DJ": "DJI",
  "DK": "DNK",
  "DM": "DMA",
  "DO": "DOM",
  "DZ": "DZA",
  "EC": "ECU",
  "EE": "EST",
  "EG": "EGY",
  "EH": "ESH",
  "ER": "ERI",
  "ES": "ESP",
  "ET": "ETH",
  "FI": "FIN",
  "FJ": "FJI",
  "FK": "FLK",
  "FM": "FSM",
  "FO": "FRO",
  "FR": "FRA",
  "GA": "GAB",
  "GB": "GBR",
  "GD": "GRD",
  "GE": "GEO",
  "GF": "GUF",
  "GG": "GGY",
  "GH": "GHA",
  "GI": "GIB",
  "GL": "GRL",
  "GM": "GMB",
  "GN": "GIN",
  "GP": "GLP",
  "GQ": "GNQ",
  "GR": "GRC",
  "GS": "SGS",
  "GT": "GTM",
  "GU": "GUM",
  "GW": "GNB",
  "GY": "GUY",
  "HK": "HKG",
  "HM": "HMD",
  "HN": "HND",
  "HR": "HRV",
  "HT": "HTI",
  "HU": "HUN",
  "ID": "IDN",
  "IE": "IRL",
  "IL": "ISR",
  "IM": "IMN",
  "IN": "IND",
  "IO": "IOT",
  "IQ": "IRQ",
  "IR": "IRN",
  "IS": "ISL",
  "IT": "ITA",
  "JE": "JEY",
  "JM": "JAM",
  "JO": "JOR",
  "JP": "JPN",
  "KE": "KEN",
  "KG": "KGZ",
  "KH": "KHM",
  "KI": "KIR",
  "KM": "COM",
  "KN": "KNA",
  "KP": "PRK",
  "KR": "KOR",
  "KW": "KWT",
  "KY": "CYM",
  "KZ": "KAZ",
  "LA": "LAO",
  "LB": "LBN",
  "LC": "LCA",
  "LI": "LIE",
  "LK": "LKA",
  "LR": "LBR",
  "LS": "LSO",
  "LT": "LTU",
  "LU": "LUX",
  "LV": "LVA",
  "LY": "LBY",
  "MA": "MAR",
  "MC": "MCO",
  "MD": "MDA",
  "ME": "MNE",
  "MF": "MAF",
  "MG": "MDG",
  "MH": "MHL",
  "MK": "MKD",
  "ML": "MLI",
  "MM": "MMR",
  "MN": "MNG",
  "MO": "MAC",
  "MP": "MNP",
  "MQ": "MTQ",
  "MR": "MRT",
  "MS": "MSR",
  "MT": "MLT",
  "MU": "MUS",
  "MV": "MDV",
  "MW": "MWI",
  "MX": "MEX",
  "MY": "MYS",
  "MZ": "MOZ",
  "NA": "NAM",
  "NC": "NCL",
  "NE": "NER",
  "NF": "NFK",
  "NG": "NGA",
  "NI": "NIC",
  "NL": "NLD",
  "NO": "NOR",
  "NP": "NPL",
  "NR": "NRU",
  "NU": "NIU",
  "NZ": "NZL",
  "OM": "OMN",
  "PA": "PAN",
  "PE": "PER",
  "PF": "PYF",
  "PG": "PNG",
  "PH": "PHL",
  "PK": "PAK",
  "PL": "POL",
  "PM": "SPM",
  "PN": "PCN",
  "PR": "PRI",
  "PS": "PSE",
  "PT": "PRT",
  "PW": "PLW",
  "PY": "PRY",
  "QA": "QAT",
  "RE": "REU",
  "RO": "ROU",
  "RS": "SRB",
  "RU": "RUS",
  "RW": "RWA",
  "SA": "SAU",
  "SB": "SLB",
  "SC": "SYC",
  "SD": "SDN",
  "SE": "SWE",
  "SG": "SGP",
  "SJ": "SJM",
  "SH": "SHN",
  "SI": "SVN",
  "SK": "SVK",
  "SL": "SLE",
  "SM": "SMR",
  "SN": "SEN",
  "SO": "SOM",
  "SR": "SUR",
  "SS": "SSD",
  "ST": "STP",
  "SV": "SLV",
  "SX": "SXM",
  "SY": "SYR",
  "SZ": "SWZ",
  "TC": "TCA",
  "TD": "TCD",
  "TF": "ATF",
  "TG": "TGO",
  "TH": "THA",
  "TJ": "TJK",
  "TK": "TKL",
  "TL": "TLS",
  "TM": "TKM",
  "TN": "TUN",
  "TO": "TON",
  "TR": "TUR",
  "TT": "TTO",
  "TV": "TUV",
  "TW": "TWN",
  "TZ": "TZA",
  "UA": "UKR",
  "UG": "UGA",
  "UM": "UMI",
  "US": "USA",
  "UY": "URY",
  "UZ": "UZB",
  "VA": "VAT",
  "VC": "VCT",
  "VE": "VEN",
  "VG": "VGB",
  "VI": "VIR",
  "VN": "VNM",
  "VU": "VUT",
  "WF": "WLF",
  "WS": "WSM",
  "YE": "YEM",
  "YT": "MYT",
  "ZA": "ZAF",
  "ZM": "ZMB",
  "ZW": "ZWE",
};

const COUNTRY_ALIASES: Record<string, string> = {
  america: "US",
  britain: "GB",
  england: "GB",
  "great britain": "GB",
  holland: "NL",
  "the netherlands": "NL",
  "u a e": "AE",
  uae: "AE",
  "u k": "GB",
  uk: "GB",
  "u s": "US",
  "u s a": "US",
  usa: "US",
};

const REGION_ALIASES: Record<string, { name: string; countryCode: string }> = {
  ab: { name: "Alberta", countryCode: "CA" },
  alberta: { name: "Alberta", countryCode: "CA" },
  bc: { name: "British Columbia", countryCode: "CA" },
  "british columbia": { name: "British Columbia", countryCode: "CA" },
  mb: { name: "Manitoba", countryCode: "CA" },
  manitoba: { name: "Manitoba", countryCode: "CA" },
  nb: { name: "New Brunswick", countryCode: "CA" },
  "new brunswick": { name: "New Brunswick", countryCode: "CA" },
  nl: { name: "Newfoundland and Labrador", countryCode: "CA" },
  "newfoundland and labrador": { name: "Newfoundland and Labrador", countryCode: "CA" },
  ns: { name: "Nova Scotia", countryCode: "CA" },
  "nova scotia": { name: "Nova Scotia", countryCode: "CA" },
  nt: { name: "Northwest Territories", countryCode: "CA" },
  "northwest territories": { name: "Northwest Territories", countryCode: "CA" },
  nu: { name: "Nunavut", countryCode: "CA" },
  nunavut: { name: "Nunavut", countryCode: "CA" },
  on: { name: "Ontario", countryCode: "CA" },
  ontario: { name: "Ontario", countryCode: "CA" },
  pe: { name: "Prince Edward Island", countryCode: "CA" },
  pei: { name: "Prince Edward Island", countryCode: "CA" },
  "prince edward island": { name: "Prince Edward Island", countryCode: "CA" },
  qc: { name: "Quebec", countryCode: "CA" },
  quebec: { name: "Quebec", countryCode: "CA" },
  sk: { name: "Saskatchewan", countryCode: "CA" },
  saskatchewan: { name: "Saskatchewan", countryCode: "CA" },
  yt: { name: "Yukon", countryCode: "CA" },
  yukon: { name: "Yukon", countryCode: "CA" },
};

// Full US state names are safe regional signals; ambiguous two-letter codes are left for review unless other data resolves them.
[
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
].forEach((name) => { REGION_ALIASES[normalizeLookup(name)] = { name, countryCode: "US" }; });

const KNOWN_CITIES: Record<string, Omit<ParsedJobLocation, "locationStatus">> = {
  halifax: { city: "Halifax", region: "Nova Scotia", country: "Canada", countryCode: "CA", latitude: 44.6488, longitude: -63.5752 },
  ottawa: { city: "Ottawa", region: "Ontario", country: "Canada", countryCode: "CA", latitude: 45.4215, longitude: -75.6972 },
  toronto: { city: "Toronto", region: "Ontario", country: "Canada", countryCode: "CA", latitude: 43.6532, longitude: -79.3832 },
  vancouver: { city: "Vancouver", region: "British Columbia", country: "Canada", countryCode: "CA", latitude: 49.2827, longitude: -123.1207 },
};

const regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
let countryNameToCode: Map<string, string> | null = null;

function normalizeLookup(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Precompute normalized header keys because map summaries may parse thousands of imported applications repeatedly.
const WORK_MODE_SPREADSHEET_HEADER_KEYS = new Set(WORK_MODE_SPREADSHEET_HEADERS.map(normalizeLookup));

function cleanLocationPart(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

function getCountryNameToCode(): Map<string, string> {
  if (countryNameToCode) return countryNameToCode;
  countryNameToCode = new Map<string, string>();

  Object.keys(COUNTRY_CODE_TO_ISO3).forEach((code) => {
    const name = regionDisplayNames.of(code);
    if (name) countryNameToCode?.set(normalizeLookup(name), code);
    countryNameToCode?.set(normalizeLookup(code), code);
    countryNameToCode?.set(normalizeLookup(COUNTRY_CODE_TO_ISO3[code]), code);
  });
  Object.entries(COUNTRY_ALIASES).forEach(([alias, code]) => countryNameToCode?.set(normalizeLookup(alias), code));
  return countryNameToCode;
}

export function normalizeCountryCode(value: unknown): string | undefined {
  const key = normalizeLookup(value);
  return getCountryNameToCode().get(key);
}

export function normalizeCountry(value: unknown): string | undefined {
  const code = normalizeCountryCode(value);
  return code ? regionDisplayNames.of(code) : undefined;
}

export function getCountryIso3(countryCode: unknown): string | undefined {
  const code = normalizeCountryCode(countryCode);
  return code ? COUNTRY_CODE_TO_ISO3[code] : undefined;
}

export function getCountryFlag(countryCode: unknown): string {
  const code = normalizeCountryCode(countryCode);
  return code ? String.fromCodePoint(...code.split("").map((character) => 127397 + character.charCodeAt(0))) : "🌐";
}

export function normalizeCity(value: unknown): string | undefined {
  const city = cleanLocationPart(value);
  const cityKey = normalizeLookup(city);
  // Spreadsheet placeholders and every work mode must never become cities, markers, or ranking entries.
  if (!city || normalizeWorkMode(city) || ["unknown", "not known", "not specified", "n a", "none", "tbd"].includes(cityKey)) return undefined;
  return city.replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

export function normalizeWorkMode(value: unknown): WorkMode | undefined {
  const key = normalizeLookup(value);
  if (!key) return undefined;
  // Normalize explicit spreadsheet wording while avoiding assumptions from an ordinary geographic location.
  if (/\b(remote|telecommute|telecommuting|virtual)\b/.test(key) || /\b(work from home|w ?f ?h)\b/.test(key)) return "Remote";
  if (/\bhybrid\b/.test(key)) return "Hybrid";
  if (/\b(on ?site|onsite|in office|office based|office only|in person|site based)\b/.test(key)) return "On-site";
  return undefined;
}

export function isRemoteLocation(value: unknown): boolean {
  return normalizeWorkMode(value) === "Remote";
}

function stripWorkMode(value: string): string {
  // Only remove explicit work-mode labels; surrounding geographic text remains untouched.
  return value
    .replace(/\((?:remote|hybrid|on[ -]?site|in[ -]?office|office[ -]?based|in[ -]?person|work from home|w\.?f\.?h\.?|telecommut(?:e|ing)|virtual)\)/gi, "")
    .replace(/(?:^|\s[-–—|/]\s)(?:remote|hybrid|on[ -]?site|in[ -]?office|office[ -]?based|in[ -]?person|work from home|w\.?f\.?h\.?|telecommut(?:e|ing)|virtual)(?=$|\s[-–—|/]\s)/gi, " ")
    .trim();
}

function getSpreadsheetWorkMode(customFields: JobApplication["customFields"]): WorkMode | undefined {
  if (!customFields) return undefined;

  // Older imports may have retained an unrecognized work-mode column as a custom field; recover it without requiring a re-import.
  for (const [header, value] of Object.entries(customFields)) {
    if (!WORK_MODE_SPREADSHEET_HEADER_KEYS.has(normalizeLookup(header))) continue;
    const workMode = normalizeWorkMode(value);
    if (workMode) return workMode;
  }

  return undefined;
}

function validCoordinate(value: unknown, min: number, max: number): number | undefined {
  if (value === "" || value == null) return undefined;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : undefined;
}

function normalizeRegion(value: unknown): { name?: string; countryCode?: string } {
  const region = cleanLocationPart(value);
  if (!region || isRemoteLocation(region)) return {};
  const alias = REGION_ALIASES[normalizeLookup(region)];
  return alias ?? { name: region };
}

export function parseJobLocation(input: string | Partial<JobApplication>): ParsedJobLocation {
  const application = typeof input === "string" ? { location: input } : input;
  const rawLocation = cleanLocationPart(application.location);
  const workMode = normalizeWorkMode(application.workMode)
    ?? getSpreadsheetWorkMode(application.customFields)
    ?? normalizeWorkMode(rawLocation);
  const latitude = validCoordinate(application.latitude, -90, 90);
  const longitude = validCoordinate(application.longitude, -180, 180);
  const structuredCity = normalizeCity(application.city);
  const structuredRegion = normalizeRegion(application.region);
  const structuredCountryCode = normalizeCountryCode(application.countryCode) ?? normalizeCountryCode(application.country);
  const structuredCountry = structuredCountryCode ? normalizeCountry(structuredCountryCode) : undefined;

  if (structuredCountryCode) {
    const locationText = stripWorkMode(rawLocation);
    const parts = locationText.split(",").map(cleanLocationPart).filter(Boolean);
    const rawCountryCode = normalizeCountryCode(parts.at(-1));
    if (parts.length >= 2 && rawCountryCode) {
      const leadingParts = parts.slice(0, -1);
      const trailingRegion = normalizeRegion(leadingParts.at(-1));
      const region = leadingParts.length > 1 || trailingRegion.countryCode === rawCountryCode ? trailingRegion.name : structuredRegion.name;
      const cityParts = region ? leadingParts.slice(0, -1) : leadingParts;
      const city = normalizeCity(cityParts.join(", "));
      // Explicit location text wins over stale enrichment when it is itself a complete, valid country expression.
      return {
        ...(city ? { city } : {}),
        ...(region ? { region } : {}),
        country: normalizeCountry(rawCountryCode),
        countryCode: rawCountryCode,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(workMode ? { workMode } : {}),
        locationStatus: "resolved",
      };
    }
    const inferredCity = structuredCity ?? (parts.length === 1 && !normalizeCountryCode(parts[0]) ? normalizeCity(parts[0]) : undefined);
    return {
      ...(inferredCity ? { city: inferredCity } : {}),
      ...(structuredRegion.name ? { region: structuredRegion.name } : {}),
      country: structuredCountry,
      countryCode: structuredCountryCode,
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(workMode ? { workMode } : {}),
      locationStatus: "resolved",
    };
  }

  const geographicText = stripWorkMode(rawLocation);
  const parts = geographicText.split(",").map(cleanLocationPart).filter(Boolean);

  if (isRemoteLocation(rawLocation) && ["americas", "anywhere", "global", "worldwide"].includes(normalizeLookup(geographicText))) {
    // Broad remote regions are work eligibility hints, not countries or plottable cities.
    return { workMode: "Remote", locationStatus: "work_mode_only" };
  }

  if (parts.length === 0 || (parts.length === 1 && normalizeWorkMode(parts[0]))) {
    return {
      ...(workMode ? { workMode } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      locationStatus: workMode ? "work_mode_only" : "needs_review",
    };
  }

  if (parts.length === 1) {
    const countryCode = normalizeCountryCode(parts[0]);
    if (countryCode) {
      return { country: normalizeCountry(countryCode), countryCode, ...(workMode ? { workMode } : {}), locationStatus: "resolved" };
    }
    const knownCity = KNOWN_CITIES[normalizeLookup(parts[0])];
    if (knownCity) return { ...knownCity, ...(workMode ? { workMode } : {}), locationStatus: "resolved" };
    return { ...(workMode ? { workMode } : {}), locationStatus: "needs_review" };
  }

  const lastPart = parts.at(-1) ?? "";
  const countryCode = normalizeCountryCode(lastPart);
  if (countryCode) {
    const leadingParts = parts.slice(0, -1);
    const trailingRegion = normalizeRegion(leadingParts.at(-1));
    const region = leadingParts.length > 1 || trailingRegion.countryCode === countryCode ? trailingRegion.name : undefined;
    const city = normalizeCity((region ? leadingParts.slice(0, -1) : leadingParts).join(", "));
    return {
      ...(city ? { city } : {}),
      ...(region ? { region } : {}),
      country: normalizeCountry(countryCode),
      countryCode,
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(workMode ? { workMode } : {}),
      locationStatus: "resolved",
    };
  }

  const region = normalizeRegion(lastPart);
  if (region.countryCode) {
    const city = normalizeCity(parts.slice(0, -1).join(", "));
    return {
      ...(city ? { city } : {}),
      region: region.name,
      country: normalizeCountry(region.countryCode),
      countryCode: region.countryCode,
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(workMode ? { workMode } : {}),
      locationStatus: "resolved",
    };
  }

  return { ...(workMode ? { workMode } : {}), locationStatus: "needs_review" };
}

export function getCountryFromLocation(input: string | Partial<JobApplication>): string | undefined {
  return parseJobLocation(input).country;
}

export function normalizeApplicationGeography<T extends Partial<JobApplication>>(application: T): T & ParsedJobLocation {
  const parsed = parseJobLocation(application);
  // The display location is intentionally preserved; normalized metadata is additive and reviewable.
  return {
    ...application,
    city: parsed.city,
    region: parsed.region,
    country: parsed.country,
    countryCode: parsed.countryCode,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    workMode: parsed.workMode,
    locationStatus: parsed.locationStatus,
  };
}

export function buildGeographySummary(applications: JobApplication[]): GeographySummary {
  const countryGroups = new Map<string, JobApplication[]>();
  const cityGroups = new Map<string, { parsed: ParsedJobLocation; applications: JobApplication[] }>();
  let remoteCount = 0;
  let needsReviewCount = 0;

  applications.forEach((application) => {
    const parsed = parseJobLocation(application);
    if (parsed.workMode === "Remote") remoteCount += 1;
    if (parsed.locationStatus === "needs_review") needsReviewCount += 1;
    if (!parsed.countryCode || !parsed.country) return;

    const countryApplications = countryGroups.get(parsed.countryCode) ?? [];
    countryApplications.push(application);
    countryGroups.set(parsed.countryCode, countryApplications);

    if (!parsed.city) return;
    const cityKey = [normalizeLookup(parsed.city), normalizeLookup(parsed.region), parsed.countryCode].join("|");
    const cityGroup = cityGroups.get(cityKey) ?? { parsed, applications: [] };
    cityGroup.applications.push(application);
    cityGroups.set(cityKey, cityGroup);
  });

  const countries = Array.from(countryGroups.entries()).map(([code, countryApplications]) => ({
    code,
    iso3: getCountryIso3(code) ?? "",
    name: normalizeCountry(code) ?? code,
    flag: getCountryFlag(code),
    count: countryApplications.length,
    percentage: applications.length ? Math.round((countryApplications.length / applications.length) * 100) : 0,
    applications: countryApplications,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const cities = Array.from(cityGroups.entries()).map(([key, group]) => ({
    key,
    city: group.parsed.city ?? "",
    region: group.parsed.region,
    country: group.parsed.country ?? "",
    countryCode: group.parsed.countryCode ?? "",
    latitude: group.parsed.latitude,
    longitude: group.parsed.longitude,
    count: group.applications.length,
    applications: group.applications,
  })).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));

  return { countries, cities, remoteCount, needsReviewCount };
}
