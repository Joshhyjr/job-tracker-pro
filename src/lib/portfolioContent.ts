import { z } from "zod";

export const MAX_PORTFOLIO_PROJECTS = 20;
export const MAX_PORTFOLIO_LIST_ITEMS = 12;

const httpsUrlSchema = z.string().trim().max(2048, "Links must be 2,048 characters or fewer.").refine(
  (value) => z.string().url().safeParse(value).success && value.startsWith("https://"),
  "Links must use HTTPS.",
);

const portfolioLinkSchema = z.object({
  label: z.string().trim().min(1, "Link labels are required.").max(40, "Link labels must be 40 characters or fewer."),
  href: z.string().trim().max(2048, "Links must be 2,048 characters or fewer.").refine(
    (value) => (value.startsWith("/") && !value.startsWith("//"))
      || (z.string().url().safeParse(value).success && value.startsWith("https://")),
    "Links must use HTTPS or start with a single slash.",
  ),
}).strict();

const orderedIdSchema = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "Item IDs may contain only letters, numbers, underscores, and hyphens."),
  order: z.number().int().min(0).max(MAX_PORTFOLIO_PROJECTS - 1),
};

export interface PortfolioProject {
  id: string;
  order: number;
  title: string;
  description: string;
  date: string;
  status?: string;
  links: Array<{ label: string; href: string }>;
  preview?: string;
  previewAlt?: string;
}

export interface PortfolioInterest { id: string; order: number; text: string }
export interface PortfolioActivity { id: string; order: number; prefix: string; highlight: string; suffix: string }
export interface PortfolioSkill { id: string; order: number; name: string; tools: string; evidence: string }
export interface PortfolioCertification { id: string; order: number; code: string; title: string; issued: string; href: string }

export interface PortfolioPageContent {
  profile: {
    name: string;
    headline: string;
    quote: string;
    location: string;
    about: string;
    greeting: string;
    introduction: string;
    statusPrompt: string;
    wallPost: string;
    wallDate: string;
    wallLikes: string;
    linkedinHref: string;
    githubHref: string;
  };
  interests: PortfolioInterest[];
  activities: PortfolioActivity[];
  projects: PortfolioProject[];
  skills: PortfolioSkill[];
  certifications: PortfolioCertification[];
}

export const portfolioProjectSchema = z.object({
  ...orderedIdSchema,
  title: z.string().trim().min(1, "Project titles are required.").max(80, "Project titles must be 80 characters or fewer."),
  description: z.string().trim().min(1, "Project descriptions are required.").max(500, "Project descriptions must be 500 characters or fewer."),
  date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Project dates must include a valid year and month."),
  status: z.string().trim().max(32, "Project status must be 32 characters or fewer.").optional(),
  links: z.array(portfolioLinkSchema).min(1, "Add at least one project link.").max(3, "Projects can have at most three links."),
  preview: z.string().regex(/^\/project-screenshots\/[A-Za-z0-9._-]+$/).optional(),
  previewAlt: z.string().trim().max(160).optional(),
}).strict() as unknown as z.ZodType<PortfolioProject>;

const profileSchema = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(80),
  headline: z.string().trim().min(1, "Your headline is required.").max(160),
  quote: z.string().trim().min(1, "Your profile quote is required.").max(240),
  location: z.string().trim().min(1, "Your location is required.").max(120),
  about: z.string().trim().min(1, "Your about text is required.").max(1000),
  greeting: z.string().trim().min(1, "Your greeting is required.").max(80),
  introduction: z.string().trim().min(1, "Your introduction is required.").max(600),
  statusPrompt: z.string().trim().min(1, "Your status prompt is required.").max(120),
  wallPost: z.string().trim().min(1, "Your wall post is required.").max(1000),
  wallDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Wall dates must include a valid date and time.")
    .refine((value) => !Number.isNaN(new Date(`${value}:00`).getTime()), "Wall dates must be valid."),
  wallLikes: z.string().trim().min(1, "The wall reaction text is required.").max(120),
  linkedinHref: httpsUrlSchema,
  githubHref: httpsUrlSchema,
}).strict();

const interestSchema = z.object({
  ...orderedIdSchema,
  text: z.string().trim().min(1, "Interests cannot be blank.").max(80),
}).strict();

const activitySchema = z.object({
  ...orderedIdSchema,
  prefix: z.string().trim().min(1, "Activity text is required.").max(160),
  highlight: z.string().trim().min(1, "Activity highlights are required.").max(80),
  suffix: z.string().trim().max(120),
}).strict();

const skillSchema = z.object({
  ...orderedIdSchema,
  name: z.string().trim().min(1, "Skill names are required.").max(80),
  tools: z.string().trim().min(1, "Skill tools are required.").max(240),
  evidence: z.string().trim().min(1, "Skill evidence is required.").max(400),
}).strict();

const certificationSchema = z.object({
  ...orderedIdSchema,
  code: z.string().trim().min(1, "Certification codes are required.").max(12),
  title: z.string().trim().min(1, "Certification titles are required.").max(160),
  issued: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Certification dates must include a valid year and month."),
  href: httpsUrlSchema,
}).strict();

function uniqueOrderedArray<T extends z.ZodTypeAny>(schema: T, label: string, max = MAX_PORTFOLIO_LIST_ITEMS) {
  return z.array(schema).min(1, `Keep at least one ${label}.`).max(max, `${label} are limited to ${max}.`).superRefine((items, context) => {
    // Stable unique IDs prevent editor rows from overwriting one another in Firestore.
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Every ${label.replace(/s$/, "")} must have a unique ID.` });
    }
  });
}

export const portfolioProjectsSchema = uniqueOrderedArray(portfolioProjectSchema, "projects", MAX_PORTFOLIO_PROJECTS) as unknown as z.ZodType<PortfolioProject[]>;

export const portfolioPageContentSchema = z.object({
  profile: profileSchema,
  interests: uniqueOrderedArray(interestSchema, "interests"),
  activities: uniqueOrderedArray(activitySchema, "activities"),
  projects: portfolioProjectsSchema,
  skills: uniqueOrderedArray(skillSchema, "skills"),
  certifications: uniqueOrderedArray(certificationSchema, "certifications"),
}).strict() as unknown as z.ZodType<PortfolioPageContent>;

export const FALLBACK_PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    id: "covid-19-sql-analysis",
    title: "COVID-19 Analysis with SQL Server",
    date: "2026-08",
    description: "Explores reported cases, deaths, population, and vaccination data with SQL joins, window functions, CTEs, and a reusable view.",
    links: [
      { label: "GitHub Repo", href: "https://github.com/Joshhyjr/Covid_19_Analysis_SQL" },
      { label: "Tableau Dashboard", href: "https://public.tableau.com/views/Covid_19_Dashboard_17871610459780/Dashboard1" },
    ],
    order: 0,
    preview: "/project-screenshots/covid-19-sql-analysis.svg",
    previewAlt: "COVID-19 SQL analysis preview with database tables and a vaccination trend chart",
  },
  {
    id: "movie-industry-analysis",
    title: "Movie Industry Analysis",
    date: "2026-08",
    description: "Examines how production budgets and audience interest relate to worldwide gross revenue using Python, regression plots, and Pearson correlations.",
    links: [{ label: "GitHub Repo", href: "https://github.com/Joshhyjr/Movie-Industry-Analysis" }],
    order: 1,
    preview: "/project-screenshots/movie-industry-analysis.svg",
    previewAlt: "Movie industry analysis preview with a budget versus gross revenue scatter plot",
  },
  {
    id: "quantium-retail-analytics",
    title: "Quantium Retail Analytics",
    date: "2026-08",
    status: "Forage case study",
    description: "Segments chip customers and evaluates three retail trial stores against matched controls in a documented adaptation of Quantium's Forage simulation.",
    links: [{ label: "GitHub Repo", href: "https://github.com/Joshhyjr/Quantium-Retail-Analytics" }],
    order: 2,
    preview: "/project-screenshots/quantium-retail-analytics.svg",
    previewAlt: "Retail analytics preview comparing sales for three trial and control stores",
  },
  {
    id: "job-tracker",
    title: "Job Tracker",
    date: "2026-06",
    description: "Track applications, manage follow-ups, and get AI-powered insights.",
    links: [
      { label: "View Project", href: "/app" },
      { label: "GitHub Repo", href: "https://github.com/Joshhyjr/job-tracker-pro" },
      { label: "Live Demo", href: "/app" },
    ],
    order: 3,
    preview: "/project-screenshots/job-tracker.png",
    previewAlt: "Job Tracker dashboard with application totals and status charts",
  },
  {
    id: "fao-hand-in-hand",
    title: "FAO Hand-in-Hand Platform",
    date: "2025-12",
    description: "Geospatial data platform for sustainable development and data visualization.",
    links: [{ label: "View Platform", href: "https://data.apps.fao.org/?lang=en" }],
    order: 4,
    preview: "/project-screenshots/fao-hand-in-hand.png",
    previewAlt: "FAO Hand-in-Hand geospatial platform showing its map interface",
  },
  {
    id: "grocery-deals-finder",
    title: "Grocery Deals Finder",
    date: "2025-10",
    description: "Search grocery deals across stores, filter by budget, and export results.",
    links: [
      { label: "Live Demo", href: "https://joshhyjr.github.io/Grocerydealsfinder/" },
      { label: "GitHub Repo", href: "https://github.com/Joshhyjr/Grocerydealsfinder" },
    ],
    order: 5,
    preview: "/project-screenshots/grocery-deals-finder.png",
    previewAlt: "Grocery Deals Finder landing page with its budget and grocery list form",
  },
  {
    id: "spam-detection-model",
    title: "Spam Detection Model",
    date: "2025-08",
    status: "Archived",
    description: "Machine learning model using NLP and TF-IDF to classify spam messages.",
    links: [{ label: "View Archived Repo", href: "https://github.com/Joshhyjr/SpamFilter" }],
    order: 6,
    preview: "/project-screenshots/spam-detection-model.svg",
    previewAlt: "Spam detection model preview classifying messages as safe or spam",
  },
];

// Checked-in content renders immediately and remains the complete recovery source if Firestore is unavailable.
export const FALLBACK_PORTFOLIO_CONTENT: PortfolioPageContent = {
  profile: {
    name: "Joshua Kivaria",
    headline: "Data Analyst · Tech Support Problem-Solver · Builder",
    quote: "I’ve got 99 problems, but messy data won’t be one.",
    location: "Halifax, Nova Scotia, Canada",
    about: "I built this space to share my journey across data analytics, technical support & the few times I’ve tinkered with software development. Here you’ll find the projects I’ve built, tools I’m learning & what experience I bring.",
    greeting: "Hello world, 👋",
    introduction: "Welcome to JK.space — part portfolio, part digital scrapbook, and part proof that I’m always learning, building, and improving.",
    statusPrompt: "What am I building next?",
    wallPost: "Just shipped a new update to Job Tracker! 🚀 Making the job search more organized and smarter. I’m currently learning Power BI & Tableau to build even stronger dashboards and data stories.",
    wallDate: "2026-06-22T21:45",
    wallLikes: "24 others like this.",
    linkedinHref: "https://www.linkedin.com/in/joshua-kivaria/",
    githubHref: "https://github.com/Joshhyjr",
  },
  interests: ["🚗 F1", "🎧 Music", "⚽ Football", "🎬 Movies & Series", "🛠️ Building things for fun"].map((text, order) => ({ id: `interest-${order + 1}`, text, order })),
  activities: [
    { id: "activity-job-tracker", prefix: "Joshua updated his project:", highlight: "Job Tracker", suffix: "", order: 0 },
    { id: "activity-skills", prefix: "Joshua added", highlight: "Python, SQL, and React", suffix: "to his skills", order: 1 },
    { id: "activity-github", prefix: "Joshua is now connected to", highlight: "GitHub", suffix: "", order: 2 },
    { id: "activity-resume", prefix: "Joshua uploaded his", highlight: "resume", suffix: "", order: 3 },
  ],
  projects: FALLBACK_PORTFOLIO_PROJECTS,
  skills: [
    { id: "data-analysis", name: "Data Analysis", tools: "Python · pandas · NumPy · Matplotlib", evidence: "IBM OPOR Data Analyst role (Experis) and Quantium simulation (Forage)", order: 0 },
    { id: "decision-support", name: "Decision Support", tools: "Excel · data storytelling · recommendations", evidence: "BCG Data for Decision Makers simulation (Forage)", order: 1 },
    { id: "sql-reporting", name: "SQL & Reporting", tools: "SQL · Tableau · dashboards · data cleaning", evidence: "StFX and Digital Nova Scotia data analytics training", order: 2 },
    { id: "technical-support", name: "Technical Support", tools: "Troubleshooting · Active Directory · Azure · documentation", evidence: "End User Support Technician role at Saint Mary’s University", order: 3 },
    { id: "frontend-development", name: "Frontend Development", tools: "React · TypeScript · Vite · Git/GitHub", evidence: "Job Tracker and Grocery Deals Finder", order: 4 },
    { id: "data-validation", name: "Data Validation", tools: "Dataset review · quality checks · geospatial platforms", evidence: "FAO Hand-in-Hand Platform internship", order: 5 },
  ],
  certifications: [
    { id: "quantium", code: "QNT", title: "Quantium – Data Analytics Job Simulation", issued: "2026-06", href: "https://www.theforage.com/completion-certificates/32A6DqtsbF7LbKdcq/NkaC7knWtjSbi6aYv_32A6DqtsbF7LbKdcq_6a145487df290a68a05f2ebf_1780413335511_completion_certificate.pdf", order: 0 },
    { id: "bcg", code: "BCG", title: "BCG – Data for Decision Makers", issued: "2026-06", href: "https://www.theforage.com/completion-certificates/SKZxezskWgmFjRvj9/Pchc5rEGyCeozqY5Z_SKZxezskWgmFjRvj9_6a145487df290a68a05f2ebf_1780397819988_completion_certificate.pdf", order: 1 },
    { id: "ibm", code: "IBM", title: "Enterprise Data Science in Practice", issued: "2026-01", href: "https://www.credly.com/badges/3d60d852-cac5-4c2b-95bc-690f71193c8e/public_url", order: 2 },
    { id: "stfx", code: "STFX", title: "Data Analytics – Digital Nova Scotia", issued: "2025-06", href: "https://learner.mycreds.ca/badges/public/assertion/XRXdtqsZRLy-ORfRRz8KMA", order: 3 },
  ],
};

export function formatPortfolioMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  // UTC avoids changing the displayed month for visitors west of Greenwich.
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatPortfolioDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(`${value}:00`));
}

export function normalizeItemOrder<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, order) => ({ ...item, order }));
}

export function normalizePortfolioContent(content: PortfolioPageContent): PortfolioPageContent {
  return {
    ...content,
    interests: normalizeItemOrder(content.interests),
    activities: normalizeItemOrder(content.activities),
    projects: normalizeItemOrder(content.projects),
    skills: normalizeItemOrder(content.skills),
    certifications: normalizeItemOrder(content.certifications),
  };
}

export function resolvePortfolioContent(value: unknown): PortfolioPageContent {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<PortfolioPageContent>
    : {};
  const hasCompleteStructure = candidate.profile && typeof candidate.profile === "object" && !Array.isArray(candidate.profile)
    && Array.isArray(candidate.interests)
    && Array.isArray(candidate.activities)
    && Array.isArray(candidate.projects)
    && Array.isArray(candidate.skills)
    && Array.isArray(candidate.certifications);

  if (hasCompleteStructure) return candidate as PortfolioPageContent;

  // Fast Refresh can preserve state created by the previous module shape; restore only missing branches.
  return {
    ...FALLBACK_PORTFOLIO_CONTENT,
    ...candidate,
    profile: {
      ...FALLBACK_PORTFOLIO_CONTENT.profile,
      ...(candidate.profile && typeof candidate.profile === "object" && !Array.isArray(candidate.profile) ? candidate.profile : {}),
    },
    interests: Array.isArray(candidate.interests) ? candidate.interests : FALLBACK_PORTFOLIO_CONTENT.interests,
    activities: Array.isArray(candidate.activities) ? candidate.activities : FALLBACK_PORTFOLIO_CONTENT.activities,
    projects: Array.isArray(candidate.projects) ? candidate.projects : FALLBACK_PORTFOLIO_CONTENT.projects,
    skills: Array.isArray(candidate.skills) ? candidate.skills : FALLBACK_PORTFOLIO_CONTENT.skills,
    certifications: Array.isArray(candidate.certifications) ? candidate.certifications : FALLBACK_PORTFOLIO_CONTENT.certifications,
  };
}
