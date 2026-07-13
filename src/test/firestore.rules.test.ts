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
});
