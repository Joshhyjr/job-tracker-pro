import type { JobApplication } from "./types";

export type DocumentCategory = "Resumes" | "Cover letters" | "Job descriptions" | "Certificates" | "Other files";
export type ApplicationDocumentField = "Resume Used" | "Cover Letter Used";
export type DocumentAttachment = { id: string; name: string; category: DocumentCategory };

export type DocumentApplicationMatch =
  | { status: "matched"; application: JobApplication }
  | { status: "ambiguous" }
  | { status: "none" };

const COMPANY_SUFFIXES = new Set([
  "and", "company", "co", "corporation", "corp", "group", "holdings", "inc", "incorporated", "limited", "llc", "ltd", "the",
]);

const DOCUMENT_TERMS = new Set([
  "application", "cover", "curriculum", "cv", "description", "document", "job", "letter", "resume", "vitae",
]);

const ROLE_TERMS = new Set([
  "associate", "coordinator", "entry", "intermediate", "junior", "lead", "manager", "officer", "senior", "specialist",
]);

function normalizeTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  return haystack.some((_, index) => needle.every((token, offset) => haystack[index + offset] === token));
}

function scoreApplication(fileTokens: string[], application: JobApplication): number | null {
  const rawCompanyTokens = normalizeTokens(application.companyName);
  const companyTokens = rawCompanyTokens.filter((token) => !COMPANY_SUFFIXES.has(token));
  if (companyTokens.length === 0) return null;

  const fileTokenSet = new Set(fileTokens.filter((token) => !DOCUMENT_TERMS.has(token)));
  const companyMatches = companyTokens.filter((token) => fileTokenSet.has(token));
  const containsFullCompany = containsSequence(fileTokens, rawCompanyTokens)
    || containsSequence(fileTokens, companyTokens);

  // A full company phrase is strongest; otherwise require at least one distinctive company token.
  if (!containsFullCompany && !companyMatches.some((token) => token.length >= 5)) return null;

  let score = containsFullCompany ? 1_000 : companyMatches.reduce((total, token) => total + 100 + token.length, 0);
  const titleTokens = normalizeTokens(application.jobTitle).filter((token) => token.length >= 3 && !ROLE_TERMS.has(token));
  const titleMatches = titleTokens.filter((token) => fileTokenSet.has(token));

  // Role words disambiguate multiple applications to the same company without being required for a unique company match.
  if (containsSequence(fileTokens, normalizeTokens(application.jobTitle))) score += 400;
  else score += titleMatches.length * 50;

  return score;
}

export function inferDocumentCategory(fileName: string, selectedCategory: DocumentCategory): DocumentCategory {
  const tokens = normalizeTokens(fileName);
  const normalized = tokens.join(" ");

  // Recognizable filename labels take precedence over the currently open tab.
  if (normalized.includes("cover letter") || normalized.includes("coverletter")) return "Cover letters";
  if (tokens.includes("resume") || tokens.includes("cv") || normalized.includes("curriculum vitae")) return "Resumes";
  if (normalized.includes("job description")) return "Job descriptions";
  if (tokens.some((token) => token === "certificate" || token === "certification")) return "Certificates";
  return selectedCategory;
}

export function getApplicationDocumentField(category: DocumentCategory): ApplicationDocumentField | null {
  if (category === "Resumes") return "Resume Used";
  if (category === "Cover letters") return "Cover Letter Used";
  return null;
}

export function getDocumentSelectionError(documents: DocumentAttachment[]): string | null {
  const fields = documents.map((document) => getApplicationDocumentField(document.category));
  if (fields.some((field) => field === null)) return "Only resumes and cover letters can be attached to an application.";
  // Each application currently has one durable field per document type, so a batch cannot contain competing files.
  if (new Set(fields).size !== fields.length) return "Choose at most one resume and one cover letter for the same application.";
  return null;
}

export type AttachDocumentsResult =
  | { status: "updated"; application: JobApplication }
  | { status: "unchanged" }
  | { status: "conflict"; field: ApplicationDocumentField; existingName: string };

export function buildApplicationDocumentAttachment(
  application: JobApplication,
  documents: DocumentAttachment[],
  now: string,
  createId: () => string,
): AttachDocumentsResult {
  const fields = documents.flatMap((document) => {
    const field = getApplicationDocumentField(document.category);
    return field ? [{ document, field }] : [];
  });

  for (const { document, field } of fields) {
    const existingName = application.customFields?.[field];
    if (existingName && existingName !== document.name) return { status: "conflict", field, existingName };
  }

  const additions = fields.filter(({ document, field }) => application.customFields?.[field] !== document.name);
  if (additions.length === 0) return { status: "unchanged" };

  // A single application update keeps the selected resume and cover letter consistent in Firestore.
  return {
    status: "updated",
    application: {
      ...application,
      customFields: {
        ...(application.customFields || {}),
        ...Object.fromEntries(additions.map(({ document, field }) => [field, document.name])),
      },
      activityLog: [
        ...additions.map(({ document, field }) => ({ id: createId(), date: now, type: "note" as const, message: `Attached ${document.name} as ${field}` })),
        ...(application.activityLog || []),
      ],
    },
  };
}

export function findDocumentApplicationMatch(fileName: string, applications: JobApplication[]): DocumentApplicationMatch {
  const fileTokens = normalizeTokens(fileName);
  const candidates = applications
    .map((application) => ({ application, score: scoreApplication(fileTokens, application) }))
    .filter((candidate): candidate is { application: JobApplication; score: number } => candidate.score !== null)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) return { status: "none" };
  // Never guess when two jobs are equally plausible, such as two roles at one company without a role in the filename.
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return { status: "ambiguous" };
  return { status: "matched", application: candidates[0].application };
}
