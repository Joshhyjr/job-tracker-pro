import type { Company, JobApplication } from "./types";

/** Normalizes only for legacy matching; rendered records use stable company IDs after migration. */
export function normalizeCompanyName(companyName: string): string {
  return companyName.toLocaleLowerCase().replace(/[\u0027\u2019]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function fallbackPrimaryColor(value: string): string {
  // Persisting a deterministic color makes unknown-company fallbacks identical across devices.
  const hash = Array.from(normalizeCompanyName(value)).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return `hsl(${hash % 360} 58% 46%)`;
}

function company(
  id: string,
  displayName: string,
  domain: string,
  options: Partial<Pick<Company, "name" | "logoUrl" | "primaryColor" | "website">> = {},
): Company {
  return {
    id,
    name: options.name ?? normalizeCompanyName(displayName),
    displayName,
    domain,
    logoUrl: options.logoUrl ?? "",
    primaryColor: options.primaryColor ?? fallbackPrimaryColor(displayName),
    website: options.website ?? (domain ? `https://${domain}/` : ""),
  };
}

// These official source URLs were verified against each company's own website or brand guidance.
export const CANONICAL_COMPANIES: readonly Company[] = [
  company("google", "Google", "google.com", {
    logoUrl: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg",
    primaryColor: "#4285F4",
    website: "https://www.google.com/",
  }),
  company("ibm", "IBM", "ibm.com", {
    logoUrl: "https://www.ibm.com/design/language/2285fa814297ab5eb0ffa21d2ee009db/ibm.svg",
    primaryColor: "#0F62FE",
    website: "https://www.ibm.com/",
  }),
  company("abm", "ABM", "abm.com", {
    logoUrl: "https://cdn.prod.website-files.com/66450aa390462a415cd93051/66450aa390462a415cd930a2_logo--default.svg",
    primaryColor: "#0040F0",
    website: "https://www.abm.com/",
  }),
  company("black-and-mcdonald", "Black & McDonald", "blackandmcdonald.com", {
    logoUrl: "https://blackandmcdonald.com/wp-content/uploads/2020/05/BlackMcDonald_Logo.png",
    primaryColor: "#00A651",
    website: "https://blackandmcdonald.com/",
  }),
  company("government-of-nova-scotia", "Government of Nova Scotia", "novascotia.ca"),
  company("government-of-alberta", "Government of Alberta", "alberta.ca", { logoUrl: "/company-logos/alberta-government.png" }),
  company("mariner-innovations", "Mariner Innovations", "marinerinnovations.com", { logoUrl: "/company-logos/mariner-innovations.png" }),
  company("amazon", "Amazon", "amazon.com"),
  company("apple", "Apple", "apple.com"),
  company("cisco", "Cisco", "cisco.com"),
  company("compugen", "Compugen", "compugen.com"),
  company("dwelly", "Dwelly", "dwelly.ca"),
  company("fao", "FAO", "fao.org"),
  company("humankind", "Humankind", "humankind.global"),
  company("inland-technologies", "Inland Technologies", "inlandgroup.aero"),
  company("jazz-aviation", "Jazz Aviation", "flyjazz.ca"),
  company("microsoft", "Microsoft", "microsoft.com"),
  company("pigment", "Pigment", "pigment.com"),
  company("publicis-groupe", "Publicis Groupe", "publicisgroupe.com"),
  company("rbc", "RBC", "rbc.com"),
  company("resmed", "ResMed", "resmed.com"),
  company("shopify", "Shopify", "shopify.com"),
  company("smu", "SMU", "smu.ca"),
  company("td-bank", "TD Bank", "td.com"),
];

const COMPANY_BY_ID = new Map(CANONICAL_COMPANIES.map((entry) => [entry.id, entry]));
const COMPANY_BY_DOMAIN = new Map(CANONICAL_COMPANIES.filter((entry) => entry.domain).map((entry) => [entry.domain, entry]));

// Aliases exist only to migrate old free-text records into a stable companyId; components never branch on them.
const LEGACY_COMPANY_ID_BY_NAME: Record<string, string> = {
  "abm integrated solutions": "abm",
  "abm industries": "abm",
  "black and macdonald": "black-and-mcdonald",
  "black and macdonald limited": "black-and-mcdonald",
  "black macdonald": "black-and-mcdonald",
  "black and mcdonald limited": "black-and-mcdonald",
  "black mcdonald": "black-and-mcdonald",
  "food and agriculture organization": "fao",
  "government of alberta": "government-of-alberta",
  "government of nova scotia": "government-of-nova-scotia",
  "govt of alberta": "government-of-alberta",
  "govt of ns": "government-of-nova-scotia",
  mariner: "mariner-innovations",
  "mariner innovation": "mariner-innovations",
  "nova scotia government": "government-of-nova-scotia",
};

CANONICAL_COMPANIES.forEach((entry) => {
  LEGACY_COMPANY_ID_BY_NAME[normalizeCompanyName(entry.displayName)] = entry.id;
  LEGACY_COMPANY_ID_BY_NAME[normalizeCompanyName(entry.name)] = entry.id;
});

export function getCompanyById(companyId?: string): Company | null {
  return COMPANY_BY_ID.get((companyId ?? "").trim()) ?? null;
}

export function getCompanyByDomain(domain?: string | null): Company | null {
  return COMPANY_BY_DOMAIN.get((domain ?? "").trim().toLocaleLowerCase().replace(/^www\./, "")) ?? null;
}

export function getLegacyCompanyByName(companyName?: string): Company | null {
  const companyId = LEGACY_COMPANY_ID_BY_NAME[normalizeCompanyName(companyName ?? "")];
  return companyId ? getCompanyById(companyId) : null;
}

function stableCompanyId(name: string, domain: string): string {
  const identity = domain || normalizeCompanyName(name) || "unknown-company";
  const slug = identity.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "company";
  const hash = Array.from(identity).reduce((total, character) => ((total * 33) ^ character.charCodeAt(0)) >>> 0, 5381).toString(36);
  return `${slug}-${hash}`;
}

export function resolveCompanyRecord(input: Pick<JobApplication, "companyId" | "companyName" | "companyDomain" | "companyLogoUrl">): Company {
  const byId = getCompanyById(input.companyId);
  if (byId) return byId;

  const normalizedDomain = (input.companyDomain ?? "").trim().toLocaleLowerCase().replace(/^www\./, "");
  const known = getCompanyByDomain(normalizedDomain) ?? getLegacyCompanyByName(input.companyName);
  // A recognized alias repairs previously generated IDs from ATS domains before preserving a custom company key.
  if (known) return known;
  if (input.companyId?.trim()) {
    // Imported custom-company IDs are already foreign keys even when the company is not in the bundled seed catalog.
    return company(input.companyId.trim(), input.companyName.trim() || "Unknown company", normalizedDomain, {
      logoUrl: input.companyLogoUrl?.trim() ?? "",
    });
  }
  // Unknown employers still receive a durable row and foreign key, without inventing an official domain or logo.
  const displayName = input.companyName.trim() || "Unknown company";
  return company(stableCompanyId(displayName, normalizedDomain), displayName, normalizedDomain, {
    logoUrl: input.companyLogoUrl?.trim() ?? "",
  });
}

export function companiesFromApplications(applications: JobApplication[]): Company[] {
  const companies = new Map<string, Company>();
  applications.forEach((application) => {
    const entry = resolveCompanyRecord(application);
    companies.set(entry.id, entry);
  });
  return Array.from(companies.values());
}
