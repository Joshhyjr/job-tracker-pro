import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import JobTrackerSidebar from "@/components/JobTrackerSidebar";

describe("JobTrackerSidebar", () => {
  it("provides usable import and export quick actions", async () => {
    const onExportCSV = vi.fn();
    const onImportXLSX = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <JobTrackerSidebar onExportCSV={onExportCSV} onExportXLSX={vi.fn()} onImportXLSX={onImportXLSX} />
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Open quick actions" }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("menuitem", { name: "Add application" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));
    expect(onExportCSV).toHaveBeenCalledOnce();

    // The hidden input remains keyboard- and test-addressable while the dropdown owns its trigger.
    const workbook = new File(["workbook"], "applications.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText("Choose an XLSX workbook from the sidebar"), { target: { files: [workbook] } });
    expect(onImportXLSX).toHaveBeenCalledWith(workbook);
  });
});
