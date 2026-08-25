import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Portfolio from "@/pages/Portfolio";

const portfolioMocks = vi.hoisted(() => ({
  auth: {
    user: null as { uid: string; email: string } | null,
    loading: false,
    error: "",
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  },
  load: vi.fn<() => Promise<null>>(),
  save: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => portfolioMocks.auth,
}));

vi.mock("@/lib/portfolioRepository", () => ({
  loadPortfolioContent: portfolioMocks.load,
  savePortfolioContent: portfolioMocks.save,
}));

describe("Portfolio", () => {
  beforeEach(() => {
    portfolioMocks.auth.user = null;
    portfolioMocks.auth.error = "";
    portfolioMocks.load.mockReset().mockResolvedValue(null);
    portfolioMocks.save.mockReset().mockImplementation(async (content) => content);
  });

  it("publishes the three repository-grounded data projects", () => {
    // This regression check keeps every requested project and its primary destination visible on the public page.
    render(
      <MemoryRouter>
        <Portfolio />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "COVID-19 Analysis with SQL Server" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tableau Dashboard" })).toHaveAttribute(
      "href",
      "https://public.tableau.com/views/Covid_19_Dashboard_17871610459780/Dashboard1",
    );
    expect(screen.getByRole("heading", { name: "Movie Industry Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quantium Retail Analytics" })).toBeInTheDocument();

    const projectWindow = screen.getByRole("list", { name: "Featured projects" });
    expect(projectWindow).toHaveClass("retro-projects-scroll");
    expect(projectWindow).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Scroll to explore ↓")).toBeInTheDocument();

    const requestedRepositories = [
      "https://github.com/Joshhyjr/Covid_19_Analysis_SQL",
      "https://github.com/Joshhyjr/Movie-Industry-Analysis",
      "https://github.com/Joshhyjr/Quantium-Retail-Analytics",
    ];
    const repositoryLinks = screen.getAllByRole("link", { name: "GitHub Repo" });
    requestedRepositories.forEach((href) => {
      expect(repositoryLinks.some((link) => link.getAttribute("href") === href)).toBe(true);
    });
    expect(screen.queryByRole("button", { name: "Edit page" })).not.toBeInTheDocument();
  });

  it("keeps static projects visible when the Firestore read fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    portfolioMocks.load.mockRejectedValueOnce(new Error("offline"));

    render(
      <MemoryRouter>
        <Portfolio />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Job Tracker" })).toBeInTheDocument();
    await waitFor(() => expect(warning).toHaveBeenCalledWith(
      "[portfolio] Using checked-in fallback content",
      expect.any(Error),
    ));
    warning.mockRestore();
  });

  it("shows page-wide editing only to the owner and publishes profile changes", async () => {
    portfolioMocks.auth.user = { uid: "owner", email: "joshuakivaria@gmail.com" };

    render(
      <MemoryRouter>
        <Portfolio />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    const editor = await screen.findByRole("dialog");
    const nameField = within(editor).getByLabelText("Name");
    fireEvent.change(nameField, { target: { value: "Joshua K. Kivaria" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Publish page changes" }));

    await waitFor(() => expect(portfolioMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ profile: expect.objectContaining({ name: "Joshua K. Kivaria" }) }),
    ));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a focused editor from an editable page card", async () => {
    portfolioMocks.auth.user = { uid: "owner", email: "joshuakivaria@gmail.com" };

    render(
      <MemoryRouter>
        <Portfolio />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const editor = await screen.findByRole("dialog");
    expect((within(editor).getByLabelText("About me") as HTMLTextAreaElement).value).toContain("data analytics");
  });

  it("blocks incomplete new projects before writing to Firestore", async () => {
    portfolioMocks.auth.user = { uid: "owner", email: "joshuakivaria@gmail.com" };

    render(
      <MemoryRouter>
        <Portfolio />
      </MemoryRouter>,
    );

    const projectsHeader = screen.getByText("Featured Projects").closest("header");
    expect(projectsHeader).not.toBeNull();
    fireEvent.click(within(projectsHeader!).getByRole("button", { name: "Edit" }));
    const editor = await screen.findByRole("dialog");
    fireEvent.click(await within(editor).findByRole("button", { name: "Add project" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Publish page changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Project titles are required.");
    expect(portfolioMocks.save).not.toHaveBeenCalled();
  });
});
