import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Portfolio from "@/pages/Portfolio";

describe("Portfolio", () => {
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
  });
});
