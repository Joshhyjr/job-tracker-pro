import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "./browserStorage";
import { getCompanyByDomain, getCompanyById, getLegacyCompanyByName, normalizeCompanyName, resolveCompanyRecord } from "./companyDirectory";
import type { JobApplication } from "./types";

export { normalizeCompanyName } from "./companyDirectory";

// Simple Icons supplies maintained SVGs for recognizable global brands when the primary provider is not configured.
const SIMPLE_ICON_SLUGS: Record<string, string> = {
  amazon: "amazon",
  apple: "apple",
  cisco: "cisco",
  google: "google",
  microsoft: "microsoft",
  rbc: "royalbankofcanada",
  resmed: "resmed",
  shopify: "shopify",
};

export type CompanyLogoSource = {
  src: string;
  presentation: "square" | "wordmark";
  provider: "stored" | "cache" | "local" | "logo-dev" | "simple-icons" | "favicon";
};

const WORDMARK_COMPANY_IDS = new Set(["abm", "black-and-mcdonald", "government-of-alberta", "ibm"]);

const RECRUITING_HOST_SUFFIXES = [
  "ashbyhq.com",
  "bamboohr.com",
  "breezy.hr",
  "glassdoor.ca",
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

type CachedCompanyBranding = {
  domain?: string;
  logo?: Pick<CompanyLogoSource, "src" | "presentation">;
  failedSources?: Record<string, number>;
};

type CompanyBrandingDirectory = Record<string, CachedCompanyBranding>;

// Versioned, minimal cache entries avoid schema drift and never store application notes or other private data.
const DIRECTORY_STORAGE_KEY = "jobtracker.companyBranding:v3";
const LEGACY_DIRECTORY_STORAGE_KEY = "jobtracker.companyDomainDirectory";
const FAILED_SOURCE_TTL_MS = 6 * 60 * 60 * 1000;

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

function readDirectory(): CompanyBrandingDirectory {
  try {
    const parsed = JSON.parse(safeLocalStorageGetItem(DIRECTORY_STORAGE_KEY) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as CompanyBrandingDirectory;
  } catch {
    // A corrupted cache must never prevent application records from rendering.
  }

  try {
    const legacy = JSON.parse(safeLocalStorageGetItem(LEGACY_DIRECTORY_STORAGE_KEY) ?? "{}");
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return {};
    // Migrate only the old domain strings; logo failures and source URLs start clean in v2.
    return Object.fromEntries(Object.entries(legacy as Record<string, unknown>).flatMap(([name, domain]) => {
      const normalizedDomain = normalizeCompanyDomain(typeof domain === "string" ? domain : "");
      return normalizedDomain ? [[name, { domain: normalizedDomain }]] : [];
    }));
  } catch {
    return {};
  }
}

function writeDirectory(directory: CompanyBrandingDirectory): void {
  safeLocalStorageSetItem(DIRECTORY_STORAGE_KEY, JSON.stringify(directory));
}

function safeImageUrl(value?: string): string | null {
  const candidate = (value ?? "").trim();
  if (!candidate) return null;
  // Only the app's curated logo folder may use a relative path.
  if (/^\/company-logos\/[a-z0-9._/-]+$/i.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    // Imported data cannot inject javascript: or data: image sources.
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getLogoDevToken(): string {
  // Logo.dev publishable keys are designed for browser use; secret search keys must never be exposed here.
  return String(import.meta.env.VITE_LOGO_DEV_PUBLISHABLE_KEY ?? "").trim();
}

function getLogoDevSource(companyName: string, domain: string | null): CompanyLogoSource | null {
  const token = getLogoDevToken();
  if (!token) return null;
  const identifier = domain ? encodeURIComponent(domain) : `name/${encodeURIComponent(companyName.trim())}`;
  return {
    src: `https://img.logo.dev/${identifier}?token=${encodeURIComponent(token)}&size=64&retina=true&format=png&fallback=404`,
    presentation: "square",
    provider: "logo-dev",
  };
}

function isTemporarilyFailed(entry: CachedCompanyBranding | undefined, src: string): boolean {
  const failedAt = entry?.failedSources?.[src] ?? 0;
  return failedAt > Date.now() - FAILED_SOURCE_TTL_MS;
}

/** Domains learned from application data are cached so one employer looks identical on every screen. */
export function learnCompanyDomains(applications: Array<{ companyName?: string; jobLink?: string; companyDomain?: string }>): void {
  const directory = readDirectory();
  let changed = false;
  applications.forEach((application) => {
    const key = normalizeCompanyName(application.companyName ?? "");
    if (!key || getLegacyCompanyByName(application.companyName)) return;
    const explicit = normalizeCompanyDomain(application.companyDomain);
    const fromLink = normalizeCompanyDomain(application.jobLink);
    const domain = explicit ?? (fromLink && !isRecruitingPlatformDomain(fromLink) ? fromLink : null);
    // Manual overrides win over previously learned values; link-derived values only fill gaps.
    if (!domain || (directory[key]?.domain && !explicit) || directory[key]?.domain === domain) return;
    directory[key] = { ...directory[key], domain };
    changed = true;
  });
  if (changed) writeDirectory(directory);
}

export type CompanyLogoInput = {
  companyId?: string;
  companyName: string;
  jobLink?: string;
  companyDomain?: string;
  /** A stored or manually supplied image always gets the first retrieval attempt. */
  companyLogoUrl?: string;
};

export function resolveCompanyDomain(companyName: string, jobLink?: string, companyDomain?: string, companyId?: string) {
  const override = normalizeCompanyDomain(companyDomain);
  const byId = getCompanyById(companyId);
  if (byId?.domain) return byId.domain;

  const knownDomain = getLegacyCompanyByName(companyName)?.domain;
  if (knownDomain) return knownDomain;
  // Canonical aliases must repair stale ATS-derived overrides already stored on legacy demo rows.
  if (override) return override;

  const learned = readDirectory()[normalizeCompanyName(companyName)]?.domain;
  if (learned) return learned;

  const hostname = normalizeCompanyDomain(jobLink);
  if (!hostname) return null;
  // ATS and aggregator favicons describe the hiring platform rather than the company itself.
  return isRecruitingPlatformDomain(hostname) ? null : hostname;
}

/** Returns trusted sources in failover order while removing duplicates and temporarily failed URLs. */
export function getCompanyLogoCandidates(companyName: string, jobLink?: string, options?: { companyId?: string; companyDomain?: string; companyLogoUrl?: string }): CompanyLogoSource[] {
  const normalizedName = normalizeCompanyName(companyName);
  const directoryEntry = readDirectory()[normalizedName];
  const domain = resolveCompanyDomain(companyName, jobLink, options?.companyDomain, options?.companyId);
  const canonical = getCompanyById(options?.companyId) ?? getCompanyByDomain(domain) ?? getLegacyCompanyByName(companyName);
  const candidates: Array<CompanyLogoSource | null> = [];

  // A canonical record is authoritative, so stale application-level URLs cannot split one company across views.
  if (canonical?.logoUrl) {
    candidates.push({
      src: canonical.logoUrl,
      presentation: WORDMARK_COMPANY_IDS.has(canonical.id) ? "wordmark" : "square",
      provider: canonical.logoUrl.startsWith("/") ? "local" : "stored",
    });
  }

  const storedLogo = safeImageUrl(options?.companyLogoUrl);
  if (storedLogo) candidates.push({ src: storedLogo, presentation: "square", provider: "stored" });

  const cachedLogo = directoryEntry?.logo;
  if (cachedLogo) candidates.push({ ...cachedLogo, provider: "cache" });

  candidates.push(getLogoDevSource(companyName, domain));

  const simpleIconSlug = SIMPLE_ICON_SLUGS[normalizedName];
  if (simpleIconSlug) {
    candidates.push({
      src: `https://cdn.simpleicons.org/${encodeURIComponent(simpleIconSlug)}?viewbox=auto`,
      presentation: "square",
      provider: "simple-icons",
    });
  }

  if (domain) {
    // The last network fallback retrieves the favicon published by the verified official domain via Google's stable endpoint.
    candidates.push({
      src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      presentation: "square",
      provider: "favicon",
    });
  }

  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (!candidate || seen.has(candidate.src) || isTemporarilyFailed(directoryEntry, candidate.src)) return [];
    seen.add(candidate.src);
    return [candidate];
  });
}

export function cacheSuccessfulCompanyLogo(companyName: string, source: CompanyLogoSource, domain?: string | null): void {
  const key = normalizeCompanyName(companyName);
  if (!key) return;
  const directory = readDirectory();
  const entry = directory[key] ?? {};
  const failedSources = { ...(entry.failedSources ?? {}) };
  delete failedSources[source.src];
  // Cache the stable source URL and domain only; the provider/browser HTTP cache retains image bytes.
  directory[key] = {
    ...(entry.domain || domain ? { domain: entry.domain ?? domain ?? undefined } : {}),
    logo: { src: source.src, presentation: source.presentation },
    ...(Object.keys(failedSources).length ? { failedSources } : {}),
  };
  writeDirectory(directory);
}

export function cacheFailedCompanyLogo(companyName: string, source: CompanyLogoSource): void {
  const key = normalizeCompanyName(companyName);
  if (!key) return;
  const directory = readDirectory();
  const entry = directory[key] ?? {};
  // Remember a confirmed two-attempt failure briefly so every row does not repeat the same broken request.
  directory[key] = {
    ...entry,
    ...(entry.logo?.src === source.src ? { logo: undefined } : {}),
    failedSources: { ...(entry.failedSources ?? {}), [source.src]: Date.now() },
  };
  writeDirectory(directory);
}

export function getCompanyLogoUrl(companyName: string, jobLink?: string) {
  return getCompanyLogoSource(companyName, jobLink)?.src ?? null;
}

export function getCompanyLogoSource(companyName: string, jobLink?: string, options?: { companyId?: string; companyDomain?: string; companyLogoUrl?: string }): CompanyLogoSource | null {
  return getCompanyLogoCandidates(companyName, jobLink, options)[0] ?? null;
}

/** Adds resolved branding to new/imported records so Firestore and XLSX round trips reuse one URL. */
export function enrichApplicationCompanyBranding<T extends Pick<JobApplication, "companyId" | "companyName" | "jobLink" | "companyDomain" | "companyLogoUrl">>(application: T): T {
  const domain = resolveCompanyDomain(application.companyName, application.jobLink, application.companyDomain, application.companyId);
  const company = resolveCompanyRecord({ ...application, companyDomain: domain ?? application.companyDomain });
  const logo = getCompanyLogoSource(company.displayName, application.jobLink, {
    companyId: company.id,
    companyDomain: company.domain || domain || application.companyDomain,
    companyLogoUrl: application.companyLogoUrl,
  });
  return {
    ...application,
    companyId: company.id,
    companyName: company.displayName,
    ...((company.domain || domain) ? { companyDomain: company.domain || domain || undefined } : {}),
    ...(logo ? { companyLogoUrl: logo.src } : {}),
  };
}

/** Initials fallback follows common acronyms while longer single names use one letter. */
export function getCompanyInitials(companyName: string): string {
  const words = normalizeCompanyName(companyName).split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0].length <= 3 ? words[0] : words[0][0]).toLocaleUpperCase();
  return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase();
}

/** Deterministic HSL colors keep the same fallback recognizable across every view. */
export function getCompanyFallbackStyle(companyName: string): { backgroundColor: string; color: string } {
  const hash = Array.from(normalizeCompanyName(companyName)).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0);
  const hue = hash % 360;
  return { backgroundColor: `hsl(${hue} 58% 88%)`, color: `hsl(${hue} 45% 28%)` };
}
