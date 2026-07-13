import { describe, expect, it } from "vitest";
import { ALLOWED_OWNER_EMAIL, isApprovedOwnerToken } from "../../api/_shared/firebaseAuth";

describe("Firebase Admin owner authorization", () => {
  it("accepts only the verified allowlisted Google email", () => {
    // Firebase identity alone is insufficient; the decoded claims must also match the single approved owner.
    expect(isApprovedOwnerToken({ email: ALLOWED_OWNER_EMAIL, email_verified: true })).toBe(true);
    expect(isApprovedOwnerToken({ email: ALLOWED_OWNER_EMAIL.toUpperCase(), email_verified: true })).toBe(true);
    expect(isApprovedOwnerToken({ email: "other@example.com", email_verified: true })).toBe(false);
    expect(isApprovedOwnerToken({ email: ALLOWED_OWNER_EMAIL, email_verified: false })).toBe(false);
    expect(isApprovedOwnerToken({ email: undefined, email_verified: true })).toBe(false);
  });
});
