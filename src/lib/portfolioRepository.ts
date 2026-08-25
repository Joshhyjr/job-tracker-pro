import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { getFirestoreDatabase, isFirebaseConfigured } from "./firebase";
import {
  FALLBACK_PORTFOLIO_PROJECTS,
  normalizePortfolioContent,
  portfolioPageContentSchema,
  portfolioProjectSchema,
  type PortfolioPageContent,
  type PortfolioProject,
} from "./portfolioContent";

const COLLECTIONS = {
  interests: "portfolioInterests",
  activities: "portfolioActivities",
  projects: "portfolioProjects",
  skills: "portfolioSkills",
  certifications: "portfolioCertifications",
} as const;

function contentProfileReference() {
  return doc(getFirestoreDatabase(), "portfolioContent", "profile");
}

function contentCollection(name: keyof typeof COLLECTIONS) {
  return collection(getFirestoreDatabase(), COLLECTIONS[name]);
}

function serializeRecord(record: { id: string; order: number } & Record<string, unknown>): DocumentData {
  const { id: _id, ...fields } = record;
  // JSON normalization removes undefined optional fields, which Firestore rejects by default.
  return JSON.parse(JSON.stringify(fields));
}

function deserializeProject(id: string, data: DocumentData): PortfolioProject {
  const fallbackAsset = FALLBACK_PORTFOLIO_PROJECTS.find((project) => project.id === id);
  // Only checked-in local assets are joined back onto otherwise public Firestore content.
  return portfolioProjectSchema.parse({
    id,
    ...data,
    preview: fallbackAsset?.preview,
    previewAlt: fallbackAsset?.previewAlt,
  });
}

function deserializeRecords(snapshot: QuerySnapshot<DocumentData>): Array<{ id: string; order: number } & Record<string, unknown>> {
  // The final Zod parse below remains authoritative for untrusted document field types.
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Array<{ id: string; order: number } & Record<string, unknown>>;
}

export async function loadPortfolioContent(): Promise<PortfolioPageContent | null> {
  if (!isFirebaseConfigured) return null;
  const [profile, interests, activities, projects, skills, certifications] = await Promise.all([
    getDocFromServer(contentProfileReference()),
    getDocsFromServer(contentCollection("interests")),
    getDocsFromServer(contentCollection("activities")),
    getDocsFromServer(contentCollection("projects")),
    getDocsFromServer(contentCollection("skills")),
    getDocsFromServer(contentCollection("certifications")),
  ]);

  // Partial or first-run cloud content never replaces the complete checked-in page.
  if (!profile.exists() || interests.empty || activities.empty || projects.empty || skills.empty || certifications.empty) return null;

  const candidate = normalizePortfolioContent({
    profile: profile.data(),
    interests: deserializeRecords(interests).sort((left, right) => Number(left.order) - Number(right.order)),
    activities: deserializeRecords(activities).sort((left, right) => Number(left.order) - Number(right.order)),
    projects: projects.docs.map((item) => deserializeProject(item.id, item.data())).sort((left, right) => left.order - right.order),
    skills: deserializeRecords(skills).sort((left, right) => Number(left.order) - Number(right.order)),
    certifications: deserializeRecords(certifications).sort((left, right) => Number(left.order) - Number(right.order)),
  } as unknown as PortfolioPageContent);

  // One malformed document invalidates the snapshot so public visitors see one coherent fallback version.
  return portfolioPageContentSchema.parse(candidate);
}

function deleteRemovedDocuments(
  batch: ReturnType<typeof writeBatch>,
  snapshot: QuerySnapshot<DocumentData>,
  incomingIds: Set<string>,
) {
  snapshot.docs.forEach((item) => {
    if (!incomingIds.has(item.id)) batch.delete(item.ref);
  });
}

export async function savePortfolioContent(content: PortfolioPageContent): Promise<PortfolioPageContent> {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured for this deployment.");
  const validated = portfolioPageContentSchema.parse(normalizePortfolioContent(content));
  const collectionNames = Object.keys(COLLECTIONS) as Array<keyof typeof COLLECTIONS>;
  const existingSnapshots = await Promise.all(collectionNames.map((name) => getDocsFromServer(contentCollection(name))));
  const batch = writeBatch(getFirestoreDatabase());

  batch.set(contentProfileReference(), validated.profile);
  collectionNames.forEach((name, collectionIndex) => {
    const records = validated[name];
    const incomingIds = new Set(records.map((record) => record.id));
    records.forEach((record) => {
      const reference = doc(contentCollection(name), record.id);
      if (name === "projects") {
        const { preview: _preview, previewAlt: _previewAlt, ...projectFields } = portfolioProjectSchema.parse(record);
        batch.set(reference, serializeRecord(projectFields));
      } else {
        batch.set(reference, serializeRecord(record));
      }
    });
    deleteRemovedDocuments(batch, existingSnapshots[collectionIndex], incomingIds);
  });

  // One bounded batch publishes every editable page section and its ordering atomically.
  await batch.commit();
  return validated;
}
