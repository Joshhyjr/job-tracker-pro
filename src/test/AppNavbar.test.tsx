import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import AppNavbar from "@/components/AppNavbar";

const requiredProps = { onExportCSV: vi.fn(), onExportXLSX: vi.fn(), onImportXLSX: vi.fn(), syncing: false, pendingSyncCount: 0, offline: false };

describe("AppNavbar", () => {
  it("keeps demo account actions grouped in the user menu", async () => {
    const onSignIn = vi.fn();
    render(<MemoryRouter initialEntries={["/app"]}><AppNavbar {...requiredProps} mode="demo" onSignIn={onSignIn} onResetDemo={vi.fn()} /></MemoryRouter>);

    // A compact utility bar keeps account details out of the primary application navigation.
    fireEvent.pointerDown(screen.getByRole("button", { name: /Demo mode/i }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log in with Google" }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it("keeps the mobile navigation closed until requested", () => {
    render(<MemoryRouter initialEntries={["/app"]}><AppNavbar {...requiredProps} mode="demo" onSignIn={vi.fn()} onResetDemo={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Job Tracker" })).toHaveClass("shrink-0");
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveClass("md:hidden");
    expect(document.getElementById("mobile-navigation")).not.toBeInTheDocument();
  });

  it("keeps both export formats in the account menu", async () => {
    const onExportCSV = vi.fn();
    const onExportXLSX = vi.fn();
    render(<MemoryRouter initialEntries={["/app/applications"]}><AppNavbar {...requiredProps} onExportCSV={onExportCSV} onExportXLSX={onExportXLSX} mode="demo" onSignIn={vi.fn()} onResetDemo={vi.fn()} /></MemoryRouter>);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Demo mode/i }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export CSV" }));
    expect(onExportCSV).toHaveBeenCalledOnce();
    fireEvent.pointerDown(screen.getByRole("button", { name: /Demo mode/i }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export XLSX" }));
    expect(onExportXLSX).toHaveBeenCalledOnce();
  });

  it("shows owner import and sign-out actions without exposing the demo login", async () => {
    const onSignOut = vi.fn();
    const user = { email: "joshuakivaria@gmail.com" } as User;
    render(<MemoryRouter initialEntries={["/app"]}><AppNavbar {...requiredProps} mode="owner" user={user} onSignOut={onSignOut} /></MemoryRouter>);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Joshua/i }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("menuitem", { name: "Import XLSX" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Log in with Google" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Choose an XLSX workbook from the navbar")).toHaveAttribute("accept", ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("reports browser-saved owner jobs waiting for cloud sync", async () => {
    const user = { email: "joshuakivaria@gmail.com" } as User;
    render(<MemoryRouter initialEntries={["/app"]}><AppNavbar {...requiredProps} pendingSyncCount={2} mode="owner" user={user} /></MemoryRouter>);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Joshua/i }), { button: 0, ctrlKey: false });

    // A pending count is actionable and does not leave the account menu claiming a permanent sync operation.
    expect(await screen.findByText("2 pending")).toBeInTheDocument();
  });
});
