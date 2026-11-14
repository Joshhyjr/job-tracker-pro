import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocalDataTransfer from "@/components/LocalDataTransfer";
import { createTransfer } from "@/lib/localTransfer";

const auth = vi.hoisted(() => ({ user: null as { uid: string } | null, loading: false, error: "", signInWithGoogle: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

// Preview must be explicit and private restore must remain gated by the active identity.
describe("local data transfer UI", () => {
  beforeEach(() => { localStorage.clear(); auth.user = null; });
  it("previews replacement and imports only after confirmation", async () => {
    localStorage.setItem("theme", "dark");
    const raw = JSON.stringify(createTransfer(localStorage));
    localStorage.setItem("theme", "light");
    render(<LocalDataTransfer />);
    const file = new File([raw], "transfer.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => raw });
    fireEvent.change(screen.getByLabelText("Choose transfer file"), { target: { files: [file] } });
    await screen.findByText(/1 storage entries/);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Restore local data" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/replace the listed local data/));
    fireEvent.click(screen.getByRole("button", { name: "Restore local data" }));
    await waitFor(() => expect(localStorage.getItem("theme")).toBe("dark"));
    expect(screen.getByText(/Import verified/)).toBeInTheDocument();
  });
  it("keeps browser data when a malformed file is selected", async () => {
    localStorage.setItem("theme", "light");
    render(<LocalDataTransfer />);
    const file = new File(["{}"], "bad.json");
    Object.defineProperty(file, "text", { value: async () => "{}" });
    fireEvent.change(screen.getByLabelText("Choose transfer file"), { target: { files: [file] } });
    await screen.findByRole("alert");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.queryByRole("button", { name: "Restore local data" })).not.toBeInTheDocument();
  });
});

// Existing Firebase migration markers must not make restored legacy rows inaccessible.
it("offers a workbook recovery path for legacy local records", () => {
  auth.user = { uid: "owner-a" };
  localStorage.setItem("job-tracker-data", "[]");
  render(<LocalDataTransfer />);
  expect(screen.getByRole("button", { name: "Export legacy application workbook" })).toBeInTheDocument();
  expect(screen.getByText(/not automatically added to Firebase/)).toBeInTheDocument();
});
