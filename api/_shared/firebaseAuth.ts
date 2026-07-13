import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

export const ALLOWED_OWNER_EMAIL = "joshuakivaria@gmail.com";
const ADMIN_APP_NAME = "job-tracker-server";

export class FirebaseAdminConfigurationError extends Error {
  constructor() {
    super("Firebase Admin authentication is not configured.");
    this.name = "FirebaseAdminConfigurationError";
  }
}

function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new FirebaseAdminConfigurationError();

  // The named server app prevents collisions with any future Firebase Admin consumers in the same function instance.
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  }, ADMIN_APP_NAME);
}

export function isApprovedOwnerToken(decodedToken: Pick<DecodedIdToken, "email" | "email_verified">): boolean {
  // Authentication is complete only when Firebase verified the email and it matches the single approved owner.
  return decodedToken.email_verified === true && decodedToken.email?.toLowerCase() === ALLOWED_OWNER_EMAIL;
}

export async function verifyOwnerIdToken(idToken: string): Promise<boolean> {
  const decodedToken = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return isApprovedOwnerToken(decodedToken);
}
