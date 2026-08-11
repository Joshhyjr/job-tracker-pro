import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeWithEmulator("Firestore Security Rules", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: "job-tracker-rules-test",
      firestore: { rules: readFileSync("firestore.rules", "utf8") },
    });
  });

  afterAll(async () => {
    await environment?.cleanup();
  });

  it("allows the verified approved owner to read and write their application", async () => {
    const firestore = environment.authenticatedContext("owner", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
    }).firestore();
    const reference = doc(firestore, "users/owner/applications/app-1");

    // The browser client may access only its own nested application documents.
    await assertSucceeds(setDoc(reference, { jobTitle: "Engineer" }));
    await assertSucceeds(getDoc(reference));
  });

  it("allows only the verified owner to maintain the normalized company directory", async () => {
    const owner = environment.authenticatedContext("owner", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
    }).firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    const reference = doc(owner, "users/owner/companies/ibm");

    // Company rows are shared by the owner's applications but remain inaccessible outside that account.
    await assertSucceeds(setDoc(reference, { display_name: "IBM", domain: "ibm.com" }));
    await assertSucceeds(getDoc(reference));
    await assertFails(getDoc(doc(anonymous, "users/owner/companies/ibm")));
  });

  it("denies anonymous, unapproved, and cross-user access", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const otherEmail = environment.authenticatedContext("owner", { email: "other@example.com", email_verified: true }).firestore();
    const approvedWrongUid = environment.authenticatedContext("approved", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
    }).firestore();
    const ownerPath = "users/owner/applications/app-1";

    // All three denial cases protect the same owner path through independent rule predicates.
    await assertFails(getDoc(doc(anonymous, ownerPath)));
    await assertFails(getDoc(doc(otherEmail, ownerPath)));
    await assertFails(getDoc(doc(approvedWrongUid, ownerPath)));
  });

  it("allows only the verified approved owner to store import recovery snapshots", async () => {
    const owner = environment.authenticatedContext("owner", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
    }).firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    const manifestPath = "users/owner/importBackups/backup-1";
    const rowPath = `${manifestPath}/applications/app-1`;

    // Both the readiness manifest and its per-job rows share the existing owner-only access predicate.
    await assertSucceeds(setDoc(doc(owner, manifestPath), { status: "writing" }));
    await assertSucceeds(setDoc(doc(owner, rowPath), { companyName: "IBM" }));
    await assertSucceeds(getDoc(doc(owner, rowPath)));
    await assertFails(getDoc(doc(anonymous, manifestPath)));
    await assertFails(getDoc(doc(anonymous, rowPath)));
  });
});
