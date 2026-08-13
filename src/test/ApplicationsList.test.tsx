import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationsList from "@/pages/ApplicationsList";
import type { JobApplication } from "@/lib/types";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    getPreferredResponseStatusOrder: () => [],
  };
});

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: overrides.id ?? "app-1",
    jobTitle: overrides.jobTitle ?? "Frontend Engineer",
    companyName: overrides.companyName ?? "Acme",
    location: overrides.location ?? "Remote",
    currentStatus: overrides.currentStatus ?? "Applied",
    responseStatus: overrides.responseStatus ?? "Applied",
    followUps: overrides.followUps ?? false,
    dateApplied: overrides.dateApplied ?? "2026-08-05",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    // Optional link input is included so drawer security tests cannot pass on a missing fixture field.
    jobLink: overrides.jobLink,
    customFields: overrides.customFields,
    activityLog: overrides.activityLog ?? [],
  };
}

const applications = [
  application({ id: "app-1", jobTitle: "Frontend Engineer", companyName: "Acme Labs", dateApplied: "2026-08-05" }),
  application({ id: "app-2", jobTitle: "Product Designer", companyName: "Acme Canada", currentStatus: "Interview", responseStatus: "Interview", dateApplied: "2026-07-15" }),
  application({ id: "app-3", jobTitle: "Data Analyst", companyName: "Beacon", dateApplied: "2025-08-05" }),
];

function renderList(overrides: Partial<React.ComponentProps<typeof ApplicationsList>> = {}) {
  const props = {
    applications,
    onSelect: vi.fn(),
    onUpdate: vi.fn().mockImplementation(async (item: JobApplication) => item),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(
    <MemoryRouter>
      <ApplicationsList {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("ApplicationsList", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it("combines partial company and current-status filters", () => {
    renderList();

    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Interview" } });

    // Combined filters should narrow the list without matching a company from another status.
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();
  });

  it("filters calendar dates by exact date, month, and year", () => {
    renderList();
    const mode = screen.getByLabelText("Date filter");

    fireEvent.change(mode, { target: { value: "month" } });
    const value = screen.getByLabelText("Date value");
    fireEvent.change(value, { target: { value: "2026-08" } });
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Product Designer")).not.toBeInTheDocument();

    fireEvent.change(mode, { target: { value: "year" } });
    fireEvent.change(value, { target: { value: "2025" } });
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();

    fireEvent.change(mode, { target: { value: "date" } });
    fireEvent.change(value, { target: { value: "2026-07-15" } });
    // Exact matching must not pull in same-day values from another year or month.
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();
  });

  it("filters an inclusive date range with optional boundaries", () => {
    renderList();
    // Date range is the default so both boundaries are immediately available.
    expect(screen.getByLabelText("Date filter")).toHaveValue("range");

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-07-15" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-08-05" } });

    // Both boundary dates stay included while applications outside the interval are removed.
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-07-15" } });

    // Leaving From blank creates an open-ended upper-bound filter.
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
  });

  it("selects and deletes only the currently filtered applications after confirmation", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderList({ onDelete });

    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));

    expect(screen.getByText("2 of 2 filtered applications selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    expect(screen.getByText(/This permanently removes only the selected applications/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    // The non-matching Beacon record must never enter the confirmed deletion batch.
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
    expect(onDelete).toHaveBeenNthCalledWith(1, "app-1");
    expect(onDelete).toHaveBeenNthCalledWith(2, "app-2");
    expect(onDelete).not.toHaveBeenCalledWith("app-3");
    await waitFor(() => expect(screen.queryByText(/filtered applications selected/)).not.toBeInTheDocument());
  });

  it("keeps failed deletions selected for a safe retry", async () => {
    const onDelete = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    renderList({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    // Successful rows leave the selection, while the rejected cloud row stays available for retry.
    await waitFor(() => expect(screen.getByText("1 of 3 filtered applications selected")).toBeInTheDocument());
    expect(screen.getByLabelText("Select Product Designer at Acme Canada")).toHaveAttribute("data-state", "checked");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Some applications were not deleted",
      variant: "destructive",
    }));
  });

  it("hides destructive selection controls for a linked read-only workbook", () => {
    renderList({ readOnly: true });

    // OneDrive-owned workbooks remain the editing authority while they are connected.
    expect(screen.queryByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();
  });

  it("keeps bulk selection out of the table header", () => {
    renderList();

    // The header remains aligned with row checkboxes without presenting an unexplained control.
    expect(screen.queryByLabelText("Select all filtered applications")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select all" })).toBeInTheDocument();
  });

  it("attaches a selected resume and cover letter to the chosen application", async () => {
    const onUpdate = vi.fn().mockImplementation(async (item: JobApplication) => item);
    const onAttachmentsComplete = vi.fn();
    renderList({
      onUpdate,
      onAttachmentsComplete,
      pendingAttachments: [
        { id: "resume", name: "Acme Resume.pdf", category: "Resumes" },
        { id: "cover", name: "Acme Cover Letter.pdf", category: "Cover letters" },
      ],
    });

    const row = screen.getByText("Frontend Engineer").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row!).getByRole("button", { name: "Attach here" }));

    // Both filenames persist in one application write, while bulk-delete selection stays out of attachment mode.
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: "app-1",
      customFields: {
        "Resume Used": "Acme Resume.pdf",
        "Cover Letter Used": "Acme Cover Letter.pdf",
      },
      activityLog: expect.arrayContaining([
        expect.objectContaining({ message: "Attached Acme Resume.pdf as Resume Used" }),
        expect.objectContaining({ message: "Attached Acme Cover Letter.pdf as Cover Letter Used" }),
      ]),
    })));
    expect(screen.queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();
    expect(onAttachmentsComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps an existing document when manual attachment would overwrite it", () => {
    const onUpdate = vi.fn().mockImplementation(async (item: JobApplication) => item);
    renderList({
      applications: [application({ customFields: { "Resume Used": "Original Resume.pdf" } })],
      onUpdate,
      pendingAttachments: [{ id: "resume", name: "Replacement Resume.pdf", category: "Resumes" }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Attach here" }));

    // Conflict handling leaves the application and attachment mode intact so the user can choose another job.
    expect(onUpdate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Existing attachment kept", variant: "destructive" }));
    expect(screen.getByText("Replacement Resume.pdf")).toBeInTheDocument();
  });

  it("shows a resolved company logo in the company column", () => {
    renderList({ applications: [application({ companyName: "Publicis Groupe" })] });

    // Known employer domains use a normalized favicon while preserving the company name as table text.
    const logo = screen.getByRole("img", { name: "Publicis Groupe logo" });
    expect(logo).toHaveAttribute("src", expect.stringContaining("domain=publicisgroupe.com"));
    expect(screen.getByText("Publicis Groupe")).toBeInTheDocument();
  });

  it("renders exact local employer logos with the correct presentation", () => {
    renderList({
      applications: [
        application({ id: "alberta", companyName: "Gov't of Alberta" }),
        application({ id: "mariner", companyName: "Mariner Innovations" }),
      ],
    });

    // Wide government branding remains legible while Mariner keeps its compact square mark.
    expect(screen.getByRole("img", { name: "Gov't of Alberta logo" })).toHaveAttribute("src", "/company-logos/alberta-government.png");
    expect(screen.getByRole("img", { name: "Mariner Innovations logo" })).toHaveAttribute("src", "/company-logos/mariner-innovations.png");
    const logoFrames = screen.getAllByTestId("company-logo");
    expect(logoFrames[0]).toHaveAttribute("data-logo-presentation", "wordmark");
    expect(logoFrames[1]).toHaveAttribute("data-logo-presentation", "square");
  });

  it("uses the status dropdown as the only status-filter surface", () => {
    renderList();

    // Removing the shortcut row avoids duplicating the complete status choices already available in the select.
    expect(screen.queryByRole("button", { name: "Applied (2)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Interview (1)" })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Status")).getByRole("option", { name: "Applied" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Status")).getByRole("option", { name: "Interview" })).toBeInTheDocument();
  });

  it("moves a board card optimistically and persists the response status", async () => {
    const onUpdate = vi.fn().mockImplementation(async (item: JobApplication) => item);
    renderList({ onUpdate });
    fireEvent.click(screen.getByRole("button", { name: "Board view" }));

    const card = screen.getByRole("article", { name: "Frontend Engineer application card" });
    const target = screen.getByRole("group", { name: "Interview column" });
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    // The board moves immediately while the shared repository confirms the durable write.
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: "Interview" })));
    expect(within(target).getByRole("article", { name: "Frontend Engineer application card" })).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Acme Labs moved to Interview." }));
  });

  it("restores a board card when persistence fails", async () => {
    renderList({ onUpdate: vi.fn().mockRejectedValue(new Error("offline")) });
    fireEvent.click(screen.getByRole("button", { name: "Board view" }));

    const card = screen.getByRole("article", { name: "Frontend Engineer application card" });
    const target = screen.getByRole("group", { name: "Interview column" });
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    // A rejected cloud write removes the optimistic override and exposes a retryable error.
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Applied column" })).getByRole("article", { name: "Frontend Engineer application card" })).toBeInTheDocument());
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Move not saved", variant: "destructive" }));
  });

  it("does not expose an executable job link in the application drawer", () => {
    renderList({
      applications: [application({ jobLink: "data:text/html,<script>alert(1)</script>" })],
    });

    fireEvent.click(screen.getByText("Frontend Engineer"));

    // The drawer revalidates records at render time so stale imports cannot bypass the persistence boundary.
    expect(screen.getByRole("heading", { name: "Frontend Engineer" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open job posting/i })).not.toBeInTheDocument();
  });

  it("keeps an absolute HTTPS job link clickable in the application drawer", () => {
    renderList({
      applications: [application({ jobLink: "https://jobs.example/frontend" })],
    });

    fireEvent.click(screen.getByText("Frontend Engineer"));

    // The same render-time guard must preserve safe posting links for existing records.
    expect(screen.getByRole("link", { name: /Open job posting/i })).toHaveAttribute("href", "https://jobs.example/frontend");
  });
});
