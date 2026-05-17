import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BoldWord } from "./BoldWord";

function render(text: string): string {
  return renderToStaticMarkup(<BoldWord text={text} />);
}

describe("BoldWord", () => {
  it("bolds the segment wrapped in ** markers", () => {
    const html = render("The cat often **thwarts** traps in the house.");
    expect(html).toContain("<strong");
    expect(html).toContain(">thwarts</strong>");
    expect(html).not.toMatch(/\*\*/);
  });

  it("handles multiple ** segments in one string", () => {
    const html = render("Le **chat** **déjoue** souvent les pièges.");
    const matches = html.match(/<strong[^>]*>/g) ?? [];
    expect(matches.length).toBe(2);
    expect(html).toContain(">chat</strong>");
    expect(html).toContain(">déjoue</strong>");
  });

  it("renders plain text when there are no ** markers", () => {
    const html = render("Just some plain text.");
    expect(html).not.toContain("<strong");
    expect(html).toContain("Just some plain text.");
  });

  it("handles ** marker around the entire string", () => {
    const html = render("**everything**");
    expect(html).toContain(">everything</strong>");
  });

  it("does not bold a stray single asterisk", () => {
    const html = render("A * is not a marker.");
    expect(html).not.toContain("<strong");
  });

  it("preserves text on either side of the marker", () => {
    const html = render("before **mid** after");
    expect(html).toContain("before ");
    expect(html).toContain(">mid</strong>");
    expect(html).toContain(" after");
  });
});
