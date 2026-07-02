import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApplicationForm from "@/pages/ApplicationForm";

const { addApplicationMock, navigateMock } = vi.hoisted(() => ({
  addApplicationMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    addApplication: addApplicationMock,
  };
});

describe("ApplicationForm", () => {
  it("saves brand-new applications with the canonical Applied response status by default", async () => {
    const onSaved = vi.fn();

    render(<ApplicationForm onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Job Title"), { target: { value: "Platform Engineer" } });
    fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "Beacon Systems" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Application" }));

    // Fresh applications should land in the same Applied bucket shown by filters and analytics.
    await waitFor(() => {
      expect(addApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
        currentStatus: "Applied",
        responseStatus: "Applied",
      }));
    });
    expect(onSaved).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/app/applications");
  });

  it("offers canonical response-status labels in the form select", () => {
    render(<ApplicationForm onSaved={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("combobox")[1]);

    // Canonical labels keep the form options aligned with stored values and dashboard filters.
    expect(screen.getByRole("option", { name: "Applied" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No Response" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Offer" })).toBeInTheDocument();
  });
});
