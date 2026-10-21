import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Testimonial } from "./Testimonial";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

describe("Testimonial", () => {
  it("is a figure: the words in a blockquote, the person in its caption", () => {
    render(
      <Testimonial
        quote="Approval before publishing got legal to say yes."
        name="Sofia Marchetti"
        role="Compliance Lead"
        company="Corvid Health"
      />,
    );
    const figure = screen.getByRole("figure");
    const quote = figure.querySelector("blockquote");
    expect(quote).not.toBeNull();
    expect(quote?.querySelector("p")).toHaveTextContent("Approval before publishing got legal to say yes.");
    const caption = figure.querySelector("figcaption") as HTMLElement;
    expect(caption).toHaveTextContent("Sofia MarchettiCompliance Lead, Corvid Health");
    // The quote is not in the caption, and the person is not in the quote.
    expect(quote).not.toHaveTextContent("Sofia");
  });

  it("cites the source work, never the person, and puts its URL on the blockquote", () => {
    const { rerender } = render(<Testimonial quote="Fast." name="Ada" />);
    expect(screen.getByRole("figure").querySelector("cite")).toBeNull();
    expect(screen.getByRole("figure").querySelector("blockquote")).not.toHaveAttribute("cite");

    rerender(<Testimonial quote="Fast." name="Ada" source="Case study" sourceUrl="https://example.com/case" />);
    const cite = screen.getByRole("figure").querySelector("cite");
    expect(cite).toHaveTextContent("Case study");
    expect(cite).not.toHaveTextContent("Ada");
    expect(screen.getByRole("figure").querySelector("blockquote")).toHaveAttribute("cite", "https://example.com/case");
  });

  it("drops a source URL safeUrl refuses from the blockquote's cite", () => {
    render(<Testimonial quote="Fast." name="Ada" source="Case study" sourceUrl="javascript:alert(1)" />);
    expect(screen.getByRole("figure").querySelector("cite")).toHaveTextContent("Case study");
    expect(screen.getByRole("figure").querySelector("blockquote")).not.toHaveAttribute("cite");
  });

  it("keeps paragraphs a caller passes as they are", () => {
    render(
      <Testimonial
        quote={
          <>
            <p>One.</p>
            <p>Two.</p>
          </>
        }
        name="Ada"
      />,
    );
    const paragraphs = screen.getByRole("figure").querySelectorAll("blockquote > p");
    expect([...paragraphs].map((p) => p.textContent)).toEqual(["One.", "Two."]);
  });

  it("shows a decorative avatar: initials by default, the photo when given, none when false", () => {
    const { rerender } = render(<Testimonial quote="Q" name="Daniel Osei" />);
    const figure = () => screen.getByRole("figure");
    // Decorative: the name beside it is the text, so no image role is announced.
    expect(within(figure()).queryByRole("img")).toBeNull();
    expect(figure().querySelector(".r-primitives-avatar")).toHaveTextContent("DO");

    rerender(<Testimonial quote="Q" name="Daniel Osei" avatar={PHOTO} />);
    expect(figure().querySelector("img")).toHaveAttribute("src", PHOTO);
    expect(figure().querySelector("img")).toHaveAttribute("alt", "");

    rerender(<Testimonial quote="Q" name="Daniel Osei" avatar={false} />);
    expect(figure().querySelector(".r-primitives-avatar")).toBeNull();
  });

  it("names a rating as a read-only image of its value, in the provider's words", () => {
    const { rerender } = render(<Testimonial quote="Q" name="Ada" rating={4.5} />);
    expect(screen.getByRole("img", { name: "Rated 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();

    rerender(
      <LocaleProvider labels={{ Testimonial: { rating: (v, max) => `${v} von ${max} Sternen` } }}>
        <Testimonial quote="Q" name="Ada" rating={3} ratingMax={4} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("img", { name: "3 von 4 Sternen" })).toBeInTheDocument();
  });

  it("writes the role or the company alone when only one is given, through the affiliation label otherwise", () => {
    const { rerender } = render(<Testimonial quote="Q" name="Ada" role="Founder" />);
    expect(screen.getByRole("figure").querySelector("figcaption")).toHaveTextContent(/^AAdaFounder$/);
    rerender(<Testimonial quote="Q" name="Ada" company="Tessellate" avatar={false} />);
    expect(screen.getByRole("figure").querySelector("figcaption")).toHaveTextContent(/^AdaTessellate$/);
    rerender(
      <Testimonial quote="Q" name="Ada" role="Founder" company="Tessellate" avatar={false} labels={{ affiliation: (r, c) => `${r} at ${c}` }} />,
    );
    expect(screen.getByRole("figure").querySelector("figcaption")).toHaveTextContent(/^AdaFounder at Tessellate$/);
  });

  it("draws each variant: a boxed card, a display-scale pull quote, a small compact one", () => {
    const { rerender } = render(<Testimonial quote="Q" name="Ada" data-testid="t" />);
    expect(screen.getByTestId("t")).toHaveAttribute("data-variant", "card");
    expect(screen.getByTestId("t")).toHaveClass("border", "rounded-lg");

    rerender(<Testimonial quote="Q" name="Ada" data-testid="t" variant="pull" />);
    expect(screen.getByTestId("t")).not.toHaveClass("border");
    expect(screen.getByTestId("t").querySelector("blockquote")).toHaveClass("text-display-3");

    rerender(<Testimonial quote="Q" name="Ada" data-testid="t" variant="compact" />);
    expect(screen.getByTestId("t").querySelector("blockquote")).toHaveClass("text-prose-3");
    expect(screen.getByTestId("t").querySelector(".r-primitives-avatar")).toHaveClass("size-icon");
  });

  it("shows a logo with its own name, and puts className on the root", () => {
    render(
      <Testimonial
        quote="Q"
        name="Ada"
        className="h-full"
        logo={<img src={PHOTO} alt="Halden Labs" />}
      />,
    );
    expect(screen.getByRole("img", { name: "Halden Labs" })).toBeInTheDocument();
    expect(screen.getByRole("figure")).toHaveClass("h-full");
  });
});
