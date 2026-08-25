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

  it("allows public portfolio reads but only validated owner writes", async () => {
    const owner = environment.authenticatedContext("portfolio-owner", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }).firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    const unapproved = environment.authenticatedContext("other-editor", {
      email: "other@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }).firestore();
    const nonGoogleOwner = environment.authenticatedContext("password-owner", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
      firebase: { sign_in_provider: "password" },
    }).firestore();
    const reference = doc(owner, "portfolioProjects/public-project");
    const validProject = {
      title: "Public project",
      description: "A safe public description.",
      date: "2026-08",
      links: [{ label: "GitHub", href: "https://github.com/example/project" }],
      order: 0,
    };
    const validProfile = {
      name: "Joshua Kivaria",
      headline: "Data Analyst",
      quote: "Always learning.",
      location: "Halifax, Nova Scotia",
      about: "A public portfolio introduction.",
      greeting: "Hello world",
      introduction: "Welcome to my portfolio.",
      statusPrompt: "What am I building next?",
      wallPost: "Published a portfolio update.",
      wallDate: "2026-08-25T10:00",
      wallLikes: "One person likes this.",
      linkedinHref: "https://www.linkedin.com/in/example/",
      githubHref: "https://github.com/example",
    };

    // Public content is readable without granting anonymous or unapproved write access.
    await assertSucceeds(setDoc(reference, validProject));
    await assertSucceeds(setDoc(doc(owner, "portfolioContent/profile"), validProfile));
    await assertSucceeds(setDoc(doc(owner, "portfolioSkills/data-analysis"), {
      name: "Data Analysis",
      tools: "Python and SQL",
      evidence: "A documented analytics project",
      order: 0,
    }));
    await assertSucceeds(getDoc(doc(anonymous, "portfolioProjects/public-project")));
    await assertSucceeds(getDoc(doc(anonymous, "portfolioContent/profile")));
    await assertSucceeds(getDoc(doc(anonymous, "portfolioSkills/data-analysis")));
    await assertFails(setDoc(doc(anonymous, "portfolioProjects/anonymous-write"), validProject));
    await assertFails(setDoc(doc(unapproved, "portfolioProjects/unapproved-write"), validProject));
    await assertFails(setDoc(doc(nonGoogleOwner, "portfolioProjects/non-google-write"), validProject));
    await assertFails(setDoc(doc(unapproved, "portfolioContent/profile"), validProfile));
  });

  it("rejects malformed portfolio fields even from the approved owner", async () => {
    const owner = environment.authenticatedContext("portfolio-validator", {
      email: "joshuakivaria@gmail.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }).firestore();
    const reference = doc(owner, "portfolioProjects/invalid-project");

    // Server-side validation is authoritative even if a browser client bypasses the editor schema.
    await assertFails(setDoc(reference, {
      title: "Invalid project",
      description: "This project tries to publish an unsafe link.",
      date: "August 2026",
      links: [{ label: "Unsafe", href: "javascript:alert(1)" }],
      order: 0,
    }));
    await assertFails(setDoc(doc(owner, "portfolioSkills/unsafe-skill"), {
      name: "",
      tools: "Python",
      evidence: "Missing a required skill name",
      order: 0,
    }));
  });
});
