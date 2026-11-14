import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Settings from "@/pages/Settings";

// Restoration must unmount tracker hooks, preventing stale in-memory writes from replacing restored rows.
it("opens transfer outside the active tracker shell", () => {
  render(<Settings mode="demo" syncing={false} offline={false} />);
  expect(screen.getByRole("link", { name: "Transfer browser data" })).toHaveAttribute("href", "/app/transfer");
  expect(screen.queryByLabelText("Choose transfer file")).not.toBeInTheDocument();
});
