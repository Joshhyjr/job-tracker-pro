import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import AppNavbar from "@/components/AppNavbar";

const requiredProps = {
  onExportCSV: vi.fn(),
  onExportXLSX: vi.fn(),
  onImportXLSX: vi.fn(),
  syncing: false,
  offline: false,
};

describe("AppNavbar", () => {
  it("shows public demo controls without private import or account controls", () => {
    const onSignIn = vi.fn();
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <AppNavbar {...requiredProps} mode="demo" onSignIn={onSignIn} onResetDemo={vi.fn()} />
      </MemoryRouter>,
    );

    // The public route stays useful while clearly offering the allowlisted Google login path.
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Import XLSX/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Log in with Google" }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it("shows cloud and sign-out controls for the authenticated owner", () => {
    const onSignOut = vi.fn();
    const user = { email: "joshuakivaria@gmail.com" } as User;
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <AppNavbar {...requiredProps} mode="owner" user={user} onSignOut={onSignOut} />
      </MemoryRouter>,
    );

    // Owner mode restores cloud-only tools and removes the public login call to action.
    expect(screen.getByRole("button", { name: /Import XLSX/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out joshuakivaria@gmail.com" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log in with Google" })).not.toBeInTheDocument();
  });
});
