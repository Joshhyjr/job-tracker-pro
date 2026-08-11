import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CompanyLogo } from "@/components/CompanyLogo";

beforeEach(() => {
  // Logo success/failure cache entries must not leak across component cases.
  localStorage.clear();
});

describe("CompanyLogo", () => {
  it("supports the concise company prop and descriptive image alt text", () => {
    render(<CompanyLogo company="Google" />);

    expect(screen.getByRole("img", { name: "Google logo" })).toHaveAttribute("loading", "lazy");
    expect(screen.getByTestId("company-logo")).toHaveAttribute("data-logo-provider", "stored");
    expect(screen.getByRole("img", { name: "Google logo" })).toHaveAttribute("src", "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg");
  });

  it("retries once, advances trusted sources, and finally shows initials", () => {
    render(<CompanyLogo companyName="Google" />);
    const firstAttempt = screen.getByRole("img", { name: "Google logo" });

    fireEvent.error(firstAttempt);
    expect(screen.getByRole("img", { name: "Google logo" }).getAttribute("src")).toContain("logo_retry=1");
    fireEvent.error(screen.getByRole("img", { name: "Google logo" }));
    // The maintained icon fallback follows the first-party asset before the verified-domain favicon.
    expect(screen.getByRole("img", { name: "Google logo" }).getAttribute("src")).toContain("cdn.simpleicons.org/google");
    fireEvent.error(screen.getByRole("img", { name: "Google logo" }));
    fireEvent.error(screen.getByRole("img", { name: "Google logo" }));
    expect(screen.getByRole("img", { name: "Google logo" }).getAttribute("src")).toContain("domain=google.com");
    fireEvent.error(screen.getByRole("img", { name: "Google logo" }));
    fireEvent.error(screen.getByRole("img", { name: "Google logo" }));

    expect(screen.getByRole("img", { name: "Google logo" })).toHaveTextContent("G");
    expect(screen.getByTestId("company-logo")).toHaveAttribute("data-logo-provider", "fallback");
  });

  it("renders a fixed custom size and a caller-provided fallback", () => {
    render(<CompanyLogo companyName="Unknown Employer" size={44} fallback="UE" rounded="full" />);

    // Unknown companies without a verified domain avoid untrusted image guesses.
    expect(screen.getByRole("img", { name: "Unknown Employer logo" })).toHaveTextContent("UE");
    expect(screen.getByTestId("company-logo")).toHaveStyle({ width: "44px", height: "44px" });
  });
});
