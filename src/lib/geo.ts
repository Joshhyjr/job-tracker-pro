// Central geographic normalization utility.
// Every location string in the app is parsed here so that pages, charts and the map
// all agree on what is a city, what is a region, what is a country and what is a work mode.

export type WorkMode = "Remote" | "Hybrid" | "On-site" | "Unknown";
export type LocationStatus = "resolved" | "needs_review" | "not_applicable";

export interface NormalizedLocation {
  city: string;
  region: string;
  country: string;
  /** ISO 3166-1 alpha-2 code — the only value used when joining data to the map. */
  countryCode: string;
  workMode: WorkMode;
  /** "needs_review" when the text could not be resolved confidently; never guessed. */
  locationStatus: LocationStatus;
  /** Original text, kept so nothing is silently rewritten. */
  raw: string;
}

/** ISO 3166-1 alpha-2 → canonical English country name. Flags are derived from the code. */
export const ISO_COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates", AR: "Argentina", AT: "Austria", AU: "Australia", BE: "Belgium",
  BG: "Bulgaria", BR: "Brazil", CA: "Canada", CH: "Switzerland", CL: "Chile", CN: "China",
  CO: "Colombia", CR: "Costa Rica", CZ: "Czechia", DE: "Germany", DK: "Denmark", EE: "Estonia",
  EG: "Egypt", ES: "Spain", FI: "Finland", FR: "France", GB: "United Kingdom", GH: "Ghana",
  GR: "Greece", HR: "Croatia", HU: "Hungary", ID: "Indonesia", IE: "Ireland", IL: "Israel",
  IN: "India", IS: "Iceland", IT: "Italy", JP: "Japan", KE: "Kenya", KR: "South Korea",
  LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MA: "Morocco", MX: "Mexico", MY: "Malaysia",
  NG: "Nigeria", NL: "Netherlands", NO: "Norway", NZ: "New Zealand", PE: "Peru",
  PH: "Philippines", PK: "Pakistan", PL: "Poland", PT: "Portugal", QA: "Qatar", RO: "Romania",
  RS: "Serbia", SA: "Saudi Arabia", SE: "Sweden", SG: "Singapore", SI: "Slovenia",
  SK: "Slovakia", TH: "Thailand", TR: "Turkey", TW: "Taiwan", UA: "Ukraine", US: "United States",
  VN: "Vietnam", ZA: "South Africa",
};

/** Extra spellings/abbreviations that must resolve to an ISO code. */
const COUNTRY_ALIAS_CODES: Record<string, string> = {
  "united states of america": "US", usa: "US", us: "US", "u s": "US", "u s a": "US", america: "US",
  uk: "GB", "u k": "GB", "great britain": "GB", britain: "GB", england: "GB", scotland: "GB",
  wales: "GB", "northern ireland": "GB", uae: "AE", "u a e": "AE", emirates: "AE",
  "the netherlands": "NL", holland: "NL", deutschland: "DE", espana: "ES", "korea": "KR",
  "republic of korea": "KR", "south korea": "KR", "czech republic": "CZ", "viet nam": "VN",
  "republic of ireland": "IE", "republic of south africa": "ZA", "türkiye": "TR", turkiye: "TR",
  can: "CA", ca: "CA", gbr: "GB", usa3: "US", deu: "DE", fra: "FR", esp: "ES", ita: "IT",
  nld: "NL", che: "CH", ind: "IN", aus: "AU", nzl: "NZ", zaf: "ZA", are: "AE", crc: "CR",
};

/** Sub-national regions we can resolve confidently, keyed by normalized name/abbreviation. */
const REGIONS: Record<string, { region: string; countryCode: string }> = {
  ...buildRegions("CA", {
    "Alberta": ["ab"], "British Columbia": ["bc"], "Manitoba": ["mb"], "New Brunswick": ["nb"],
    "Newfoundland and Labrador": ["nl", "newfoundland"], "Nova Scotia": ["ns"],
    "Northwest Territories": ["nt"], "Nunavut": ["nu"], "Ontario": ["on"],
    "Prince Edward Island": ["pe", "pei"], "Quebec": ["qc", "québec"], "Saskatchewan": ["sk"],
    "Yukon": ["yt"],
  }),
  ...buildRegions("US", {
    "Alabama": ["al"], "Alaska": ["ak"], "Arizona": ["az"], "Arkansas": ["ar"], "California": ["ca"],
    "Colorado": ["co"], "Connecticut": ["ct"], "Delaware": ["de"], "Florida": ["fl"], "Georgia": ["ga"],
    "Hawaii": ["hi"], "Idaho": ["id"], "Illinois": ["il"], "Indiana": ["in"], "Iowa": ["ia"],
    "Kansas": ["ks"], "Kentucky": ["ky"], "Louisiana": ["la"], "Maine": ["me"], "Maryland": ["md"],
    "Massachusetts": ["ma"], "Michigan": ["mi"], "Minnesota": ["mn"], "Mississippi": ["ms"],
    "Missouri": ["mo"], "Montana": ["mt"], "Nebraska": ["ne"], "Nevada": ["nv"],
    "New Hampshire": ["nh"], "New Jersey": ["nj"], "New Mexico": ["nm"], "New York State": ["ny"],
    "North Carolina": ["nc"], "North Dakota": ["nd"], "Ohio": ["oh"], "Oklahoma": ["ok"],
    "Oregon": ["or"], "Pennsylvania": ["pa"], "Rhode Island": ["ri"], "South Carolina": ["sc"],
    "South Dakota": ["sd"], "Tennessee": ["tn"], "Texas": ["tx"], "Utah": ["ut"], "Vermont": ["vt"],
    "Virginia": ["va"], "Washington State": ["wa"], "West Virginia": ["wv"], "Wisconsin": ["wi"],
    "Wyoming": ["wy"], "District of Columbia": ["dc"],
  }),
};

/**
 * Cities we can attribute to a country without any external lookup. This is deliberately a
 * disambiguation aid, not a geocoder: unknown cities are marked needs_review, never guessed.
 */
const KNOWN_CITY_COUNTRIES: Record<string, { city: string; region?: string; countryCode: string }> = {
  halifax: { city: "Halifax", region: "Nova Scotia", countryCode: "CA" },
  toronto: { city: "Toronto", region: "Ontario", countryCode: "CA" },
  ottawa: { city: "Ottawa", region: "Ontario", countryCode: "CA" },
  montreal: { city: "Montreal", region: "Quebec", countryCode: "CA" },
  vancouver: { city: "Vancouver", region: "British Columbia", countryCode: "CA" },
  calgary: { city: "Calgary", region: "Alberta", countryCode: "CA" },
  edmonton: { city: "Edmonton", region: "Alberta", countryCode: "CA" },
  winnipeg: { city: "Winnipeg", region: "Manitoba", countryCode: "CA" },
  dartmouth: { city: "Dartmouth", region: "Nova Scotia", countryCode: "CA" },
  moncton: { city: "Moncton", region: "New Brunswick", countryCode: "CA" },
  "quebec city": { city: "Quebec City", region: "Quebec", countryCode: "CA" },
  mississauga: { city: "Mississauga", region: "Ontario", countryCode: "CA" },
  "new york": { city: "New York", region: "New York State", countryCode: "US" },
  "new york city": { city: "New York", region: "New York State", countryCode: "US" },
  nyc: { city: "New York", region: "New York State", countryCode: "US" },
  boston: { city: "Boston", region: "Massachusetts", countryCode: "US" },
  chicago: { city: "Chicago", region: "Illinois", countryCode: "US" },
  seattle: { city: "Seattle", region: "Washington State", countryCode: "US" },
  austin: { city: "Austin", region: "Texas", countryCode: "US" },
  atlanta: { city: "Atlanta", region: "Georgia", countryCode: "US" },
  "san francisco": { city: "San Francisco", region: "California", countryCode: "US" },
  "los angeles": { city: "Los Angeles", region: "California", countryCode: "US" },
  london: { city: "London", countryCode: "GB" },
  manchester: { city: "Manchester", countryCode: "GB" },
  dublin: { city: "Dublin", countryCode: "IE" },
  amsterdam: { city: "Amsterdam", countryCode: "NL" },
  rotterdam: { city: "Rotterdam", countryCode: "NL" },
  "the hague": { city: "The Hague", countryCode: "NL" },
  madrid: { city: "Madrid", countryCode: "ES" },
  barcelona: { city: "Barcelona", countryCode: "ES" },
  valencia: { city: "Valencia", countryCode: "ES" },
  rome: { city: "Rome", countryCode: "IT" },
  milan: { city: "Milan", countryCode: "IT" },
  turin: { city: "Turin", countryCode: "IT" },
  geneva: { city: "Geneva", countryCode: "CH" },
  zurich: { city: "Zurich", countryCode: "CH" },
  bern: { city: "Bern", countryCode: "CH" },
  basel: { city: "Basel", countryCode: "CH" },
  lausanne: { city: "Lausanne", countryCode: "CH" },
  paris: { city: "Paris", countryCode: "FR" },
  lyon: { city: "Lyon", countryCode: "FR" },
  berlin: { city: "Berlin", countryCode: "DE" },
  munich: { city: "Munich", countryCode: "DE" },
  hamburg: { city: "Hamburg", countryCode: "DE" },
  lisbon: { city: "Lisbon", countryCode: "PT" },
  porto: { city: "Porto", countryCode: "PT" },
  "san jose": { city: "San José", countryCode: "CR" },
  "san josé": { city: "San José", countryCode: "CR" },
  dubai: { city: "Dubai", countryCode: "AE" },
  "abu dhabi": { city: "Abu Dhabi", countryCode: "AE" },
  singapore: { city: "Singapore", countryCode: "SG" },
  sydney: { city: "Sydney", countryCode: "AU" },
  melbourne: { city: "Melbourne", countryCode: "AU" },
  tokyo: { city: "Tokyo", countryCode: "JP" },
  zagreb: { city: "Zagreb", countryCode: "HR" },
  nairobi: { city: "Nairobi", countryCode: "KE" },
  lagos: { city: "Lagos", countryCode: "NG" },
  "cape town": { city: "Cape Town", countryCode: "ZA" },
  johannesburg: { city: "Johannesburg", countryCode: "ZA" },
  bangalore: { city: "Bangalore", countryCode: "IN" },
  bengaluru: { city: "Bengaluru", countryCode: "IN" },
  mumbai: { city: "Mumbai", countryCode: "IN" },
  delhi: { city: "Delhi", countryCode: "IN" },
};

function buildRegions(countryCode: string, entries: Record<string, string[]>) {
  const map: Record<string, { region: string; countryCode: string }> = {};
  Object.entries(entries).forEach(([region, aliases]) => {
    [region, ...aliases].forEach((alias) => {
      map[normalizeKey(alias)] = { region, countryCode };
    });
  });
  return map;
}

/** Lowercase, accent-free, punctuation-free lookup key. */
export function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  Object.entries(ISO_COUNTRY_NAMES).forEach(([code, name]) => {
    map[normalizeKey(name)] = code;
    map[normalizeKey(code)] = code;
  });
  Object.entries(COUNTRY_ALIAS_CODES).forEach(([alias, code]) => {
    map[normalizeKey(alias)] = code;
  });
  return map;
})();

const WORK_MODE_PATTERNS: { mode: WorkMode; pattern: RegExp }[] = [
  { mode: "Hybrid", pattern: /\bhybrid\b/i },
  { mode: "Remote", pattern: /\b(remote|work from home|wfh|telecommute|anywhere|virtual)\b/i },
  { mode: "On-site", pattern: /\b(on ?site|onsite|in ?office|in ?person)\b/i },
];

const NON_LOCATION_TOKENS = /^(n\/a|na|none|tbd|unknown|various|multiple|blank|-)$/i;

/** True when the text describes a work mode rather than a place. */
export function isRemoteLocation(value: string): boolean {
  return /\b(remote|work from home|wfh|telecommute|anywhere|virtual)\b/i.test(value ?? "");
}

/** Detect the work mode contained in any free-text location. */
export function getWorkMode(value: string): WorkMode {
  const found = WORK_MODE_PATTERNS.find(({ pattern }) => pattern.test(value ?? ""));
  return found?.mode ?? "Unknown";
}

/** Resolve any country spelling/abbreviation to an ISO 3166-1 alpha-2 code ("" when unknown). */
export function normalizeCountryCode(value: unknown): string {
  return COUNTRY_CODE_BY_NAME[normalizeKey(value)] ?? "";
}

/** Resolve any country spelling to its canonical English name ("" when unknown). */
export function normalizeCountry(value: unknown): string {
  const code = normalizeCountryCode(value);
  return code ? ISO_COUNTRY_NAMES[code] : "";
}

/** Title-case a city name and reject work modes / placeholders. */
export function normalizeCity(value: unknown): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || NON_LOCATION_TOKENS.test(text) || getWorkMode(text) !== "Unknown") return "";
  if (normalizeCountryCode(text) || REGIONS[normalizeKey(text)]) return "";
  const known = KNOWN_CITY_COUNTRIES[normalizeKey(text)];
  if (known) return known.city;
  return text.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

/** Flag emoji derived from the ISO code, so no per-country flag table is needed. */
export function getCountryFlag(countryCode: string): string {
  const code = (countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((character) => 0x1f1e6 + character.charCodeAt(0) - 65));
}

function emptyLocation(raw: string, workMode: WorkMode, status: LocationStatus): NormalizedLocation {
  return { city: "", region: "", country: "", countryCode: "", workMode, locationStatus: status, raw };
}

/**
 * Parse a free-text job location into structured geography plus a work mode.
 * Never returns a country for work modes, cities or regions — unresolved input is flagged.
 */
export function parseJobLocation(value: unknown): NormalizedLocation {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  const workMode = getWorkMode(raw);

  if (!raw || NON_LOCATION_TOKENS.test(raw)) return emptyLocation(raw, workMode, "not_applicable");

  // Strip work-mode tokens and parenthetical notes so "Halifax, NS (Hybrid)" still parses geographically.
  const geographicText = raw
    .replace(/\((?:[^)]*)\)/g, " ")
    .replace(/\b(hybrid|remote|on ?site|onsite|in ?office|in ?person|work from home|wfh|telecommute|virtual|anywhere)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = geographicText.split(",").map((part) => part.trim()).filter((part) => part && !NON_LOCATION_TOKENS.test(part));
  if (parts.length === 0) {
    // Pure work-mode strings such as "Remote" are valid records, just not geographic ones.
    return emptyLocation(raw, workMode, workMode === "Unknown" ? "needs_review" : "not_applicable");
  }

  let countryCode = "";
  let region = "";
  let city = "";
  const remaining: string[] = [];

  parts.forEach((part) => {
    if (!countryCode && normalizeCountryCode(part)) {
      countryCode = normalizeCountryCode(part);
      return;
    }
    const regionMatch = REGIONS[normalizeKey(part)];
    if (!region && regionMatch) {
      region = regionMatch.region;
      if (!countryCode) countryCode = regionMatch.countryCode;
      return;
    }
    remaining.push(part);
  });

  city = normalizeCity(remaining[0] ?? "");

  // A known city can supply its country and region when the text omits them.
  const knownCity = KNOWN_CITY_COUNTRIES[normalizeKey(city)];
  if (knownCity && (!countryCode || countryCode === knownCity.countryCode)) {
    city = knownCity.city;
    countryCode = countryCode || knownCity.countryCode;
    region = region || knownCity.region || "";
  }

  if (!countryCode) {
    // Accuracy over coverage: an unknown place is flagged, never attributed to a guessed country.
    return { city, region, country: "", countryCode: "", workMode, locationStatus: "needs_review", raw };
  }

  return {
    city,
    region,
    country: ISO_COUNTRY_NAMES[countryCode] ?? "",
    countryCode,
    workMode,
    locationStatus: "resolved",
    raw,
  };
}

/** Canonical country name for a free-text location ("" when it is remote/unknown). */
export function getCountryFromLocation(value: unknown): string {
  return parseJobLocation(value).country;
}
