import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartStyle } from "@/components/ui/chart";

describe("ChartStyle security", () => {
  it("sanitizes selectors and variables and omits unsafe color values", () => {
    const markup = renderToStaticMarkup(
      <ChartStyle
        id={'weekly"] { color: red; }'}
        config={{
          'Revenue"] { display: block; }': { color: "#123abc" },
          unsafe: { color: "red; } body { display: none" },
        }}
      />,
    );

    // The raw style element may contain only normalized names and validated color grammar.
    expect(markup).toContain('[data-chart="weekly-color-red"]');
    expect(markup).toContain("--color-revenue-display-block: #123abc;");
    expect(markup).not.toContain("--color-unsafe");
    expect(markup).not.toContain("body { display: none");
  });
});
