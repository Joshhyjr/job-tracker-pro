import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "./browserStorage";

const KNOWN_COMPANY_DOMAINS: Record<string, string> = {
  abm: "abm.com",
  amazon: "amazon.com",
  compugen: "compugen.com",
  dwelly: "dwelly.ca",
  fao: "fao.org",
  google: "google.com",
  humankind: "humankind.global",
  ibm: "ibm.com",
  "inland technologies": "inlandgroup.aero",
  "jazz aviation": "flyjazz.ca",
  microsoft: "microsoft.com",
  pigment: "pigment.com",
  "publicis groupe": "publicisgroupe.com",
  rbc: "rbc.com",
  resmed: "resmed.com",
  shopify: "shopify.com",
  smu: "smu.ca",
  "td bank": "td.com",
};

const COMPANY_ALIASES: Record<string, string> = {
  "government of alberta": "alberta.ca",
  "government of nova scotia": "novascotia.ca",
  "govt of alberta": "alberta.ca",
  "govt of ns": "novascotia.ca",
  "nova scotia government": "novascotia.ca",
};

export type CompanyLogoSource = {
  src: string;
  presentation: "square" | "wordmark";
};

const ALBERTA_GOVERNMENT_LOGO: CompanyLogoSource = {
  src: "/company-logos/alberta-government.png",
  presentation: "wordmark",
};

const MARINER_INNOVATIONS_LOGO: CompanyLogoSource = {
  src: "/company-logos/mariner-innovations.png",
  presentation: "square",
};

const LOCAL_COMPANY_LOGOS: Record<string, CompanyLogoSource> = {
  // Exact local assets keep official employer branding stable when favicons are generic or misleading.
  "alberta government": ALBERTA_GOVERNMENT_LOGO,
  "government of alberta": ALBERTA_GOVERNMENT_LOGO,
  "govt of alberta": ALBERTA_GOVERNMENT_LOGO,
  mariner: MARINER_INNOVATIONS_LOGO,
  "mariner innovation": MARINER_INNOVATIONS_LOGO,
  "mariner innovations": MARINER_INNOVATIONS_LOGO,
};

const RECRUITING_HOST_SUFFIXES = [
  "ashbyhq.com",
  "bamboohr.com",
  "breezy.hr",
  "glassdoor.com",
  "greenhouse.io",
  "icims.com",
  "indeed.com",
  "jobvite.com",
  "lever.co",
  "linkedin.com",
  "monster.com",
  "myworkdayjobs.com",
  "recruitee.com",
  "smartrecruiters.com",
  "successfactors.com",
  "taleo.net",
  "workable.com",
  "workday.com",
  "workdayjobs.com",
  "ziprecruiter.com",
];

/** Domains learned from application data are cached so one employer looks identical on every screen. */
const DIRECTORY_STORAGE_KEY = "jobtracker.companyDomainDirectory";

function normalizeCompanyName(companyName: string) {
  // Removing apostrophes before spacing makes variants such as “Gov't” match the curated “govt” alias.
  return companyName.toLocaleLowerCase().replace(/[\u0027\u2019]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Accepts either a bare domain or a full URL and returns a normalized, validated hostname. */
export function normalizeCompanyDomain(value?: string): string | null {
  const raw = (value ?? "").trim().toLocaleLowerCase();
  if (!raw) return null;
  const candidate = raw.includes("://") ? raw : `https://${raw}`;
  try {
    const hostname = new URL(candidate).hostname.replace(/^www\./, "");
    // A usable logo domain must look like a real registrable host, never an IP or single label.
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function isRecruitingPlatformDomain(hostname: string): boolean {
  return RECRUITING_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function readDirectory(): Record<string, string> {
  try {
    const parsed = JSON.parse(safeLocalStorageGetItem(DIRECTORY_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    // Corrupted cache should degrade to curated/link resolution rather than break rendering.
    return {};
  }
}

/**
 * Learns employer domains from applications that link directly to a company site so the same
 * company shows the same logo on rows that only have a name or an ATS link.
 */
export function learnCompanyDomains(applications: Array<{ companyName?: string; jobLink?: string; companyDomain?: string }>): void {
  const directory = readDirectory();
  let changed = false;
  applications.forEach((application) => {
    const key = normalizeCompanyName(application.companyName ?? "");
    if (!key || KNOWN_COMPANY_DOMAINS[key] || COMPANY_ALIASES[key]) return;
    const explicit = normalizeCompanyDomain(application.companyDomain);
    const fromLink = normalizeCompanyDomain(application.jobLink);
    const domain = explicit ?? (fromLink && !isRecruitingPlatformDomain(fromLink) ? fromLink : null);
    // Manual overrides win over previously learned values; link-derived values only fill gaps.
    if (!domain || (directory[key] && !explicit)) return;
    if (directory[key] === domain) return;
    directory[key] = domain;
    changed = true;
  });
  if (changed) safeLocalStorageSetItem(DIRECTORY_STORAGE_KEY, JSON.stringify(directory));
}

export type CompanyLogoInput = {
  companyName: string;
  jobLink?: string;
  /** Manual override entered by the user on the application detail page. */
  companyDomain?: string;
  /** Manual override image URL that bypasses domain resolution entirely. */
  companyLogoUrl?: string;
};

export function resolveCompanyDomain(companyName: string, jobLink?: string, companyDomain?: string) {
  const override = normalizeCompanyDomain(companyDomain);
  if (override) return override;

  const normalized = normalizeCompanyName(companyName);
  const knownDomain = KNOWN_COMPANY_DOMAINS[normalized] ?? COMPANY_ALIASES[normalized];
  if (knownDomain) return knownDomain;

  const learned = readDirectory()[normalized];
  if (learned) return learned;

  const hostname = normalizeCompanyDomain(jobLink);
  if (!hostname) return null;
  // ATS and aggregator favicons describe the hiring platform rather than the company itself.
  return isRecruitingPlatformDomain(hostname) ? null : hostname;
}

export function getCompanyLogoUrl(companyName: string, jobLink?: string) {
  return getCompanyLogoSource(companyName, jobLink)?.src ?? null;
}

/** Initials fallback used whenever no verified logo exists for a company. */
export function getCompanyInitials(companyName: string): string {
  const words = normalizeCompanyName(companyName).split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`).toLocaleUpperCase();
}

function safeImageUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    // Only http(s) images are rendered so imported data cannot inject javascript:/data: sources.
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getCompanyLogoSource(companyName: string, jobLink?: string, options?: { companyDomain?: string; companyLogoUrl?: string }): CompanyLogoSource | null {
  const manualLogo = safeImageUrl(options?.companyLogoUrl);
  if (manualLogo) return { src: manualLogo, presentation: "square" };

  const localLogo = LOCAL_COMPANY_LOGOS[normalizeCompanyName(companyName)];
  if (localLogo) return localLogo;

  const domain = resolveCompanyDomain(companyName, jobLink, options?.companyDomain);
  if (!domain) return null;
  // Google serves a single, size-normalized favicon endpoint so CSP stays narrow and predictable.
  return {
    src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    presentation: "square",
  };
}
