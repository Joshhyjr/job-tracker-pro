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
  "greenhouse.io",
  "indeed.com",
  "lever.co",
  "linkedin.com",
  "myworkdayjobs.com",
  "workday.com",
  "workdayjobs.com",
];

function normalizeCompanyName(companyName: string) {
  // Removing apostrophes before spacing makes variants such as “Gov't” match the curated “govt” alias.
  return companyName.toLocaleLowerCase().replace(/[\u0027\u2019]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function resolveCompanyDomain(companyName: string, jobLink?: string) {
  const normalized = normalizeCompanyName(companyName);
  const knownDomain = KNOWN_COMPANY_DOMAINS[normalized] ?? COMPANY_ALIASES[normalized];
  if (knownDomain) return knownDomain;

  if (!jobLink) return null;
  try {
    const hostname = new URL(jobLink).hostname.toLocaleLowerCase().replace(/^www\./, "");
    // ATS and aggregator favicons describe the hiring platform rather than the company itself.
    if (RECRUITING_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) return null;
    return hostname || null;
  } catch {
    return null;
  }
}

export function getCompanyLogoUrl(companyName: string, jobLink?: string) {
  return getCompanyLogoSource(companyName, jobLink)?.src ?? null;
}

export function getCompanyLogoSource(companyName: string, jobLink?: string): CompanyLogoSource | null {
  const localLogo = LOCAL_COMPANY_LOGOS[normalizeCompanyName(companyName)];
  if (localLogo) return localLogo;

  const domain = resolveCompanyDomain(companyName, jobLink);
  if (!domain) return null;
  // Google serves a single, size-normalized favicon endpoint so CSP stays narrow and predictable.
  return {
    src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    presentation: "square",
  };
}
