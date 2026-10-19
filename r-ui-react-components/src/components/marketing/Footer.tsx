"use client";

import { ChevronDown } from "lucide-react";
import { type ComponentPropsWithRef, createContext, type ElementType, type ReactNode, useContext, useId, useState } from "react";

import { elementChildren } from "../../util/children";
import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { Container, Section } from "../layout";
import { Link, type LinkProps } from "../primitives";

export interface FooterLabels {
  /** The legal row's navigation name. */
  legal: string;
  /** The social links list's name. */
  social: string;
  /** The copyright line, from the holder (`copyright`) and the year. */
  copyright: (holder: string, year: number) => string;
}

export const DEFAULT_FOOTER_LABELS: FooterLabels = {
  legal: "Legal",
  social: "Social media",
  copyright: (holder, year) => `© ${year} ${holder}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Footer: FooterLabels;
  }
}

export type FooterHeadingLevel = 2 | 3 | 4 | 5 | 6;

/**
 * - `plain` (default): on the canvas, a hairline above.
 * - `band`: the raised band (`--C-SURFACE-1`), as `Section variant="band"`.
 */
export type FooterVariant = "plain" | "band";

export type FooterProps = {
  /** The brand: a logo and a line about the product. Screen only. */
  brand?: ReactNode;
  /** A sign-up form (an email capture, any node), under the brand. Screen only. */
  newsletter?: ReactNode;
  /** A language / region control (a `Select` bound to the app's `LocaleProvider`, any node), in the bottom row. Screen only. */
  localeSwitcher?: ReactNode;
  /** `Footer.SocialLink`s (or any elements), each put in a list item of a named list. Screen only. */
  social?: ReactNode;
  /** The copyright holder ("Kiln Labs, Inc."), written through the `copyright` label with `year`. */
  copyright?: string;
  /** The copyright year. Default: this year. */
  year?: number;
  /** Policy links (`Footer.Link`s), each put in a list item of the "Legal" navigation. */
  legal?: ReactNode;
  variant?: FooterVariant;
  /** The columns' heading level for the page outline (default 2). */
  headingLevel?: FooterHeadingLevel;
  /** `div` where the page already has its `contentinfo` (a footer inside a card or a dialog). Default `footer`. */
  as?: "footer" | "div";
  labels?: LabelsProp<FooterLabels>;
  classNames?: SlotClassNames<
    "container" | "top" | "brand" | "newsletter" | "columns" | "bottom" | "copyright" | "legal" | "social" | "locale"
  >;
  /** `Footer.Column`s. */
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"footer">, "children">;

const HeadingLevel = createContext<FooterHeadingLevel>(2);

/**
 * A site footer: the brand and a newsletter slot, columns of links, and a bottom
 * row with the copyright and policy links on one side and social links and a
 * locale switcher on the other.
 *
 * Each column is a `nav` landmark named by its heading. The footer is a size
 * container: when IT is narrower than 28rem (`@md`), whatever the viewport, the
 * columns stack into an accordion (each heading a disclosure button, closed by
 * default); wider, they sit side by side, each at least `--COLUMN-SM`, and the
 * buttons are gone. Both forms are in the markup and CSS picks one, so nothing
 * jumps on load. The brand and newsletter sit above the columns, and beside
 * them (a third of the width) from 64rem (`@5xl`), where three columns still
 * fit side by side in the rest.
 *
 * Printed, only the copyright and the legal links remain (`data-print="hide"` on
 * the rest).
 */
function FooterRoot({
  brand,
  newsletter,
  localeSwitcher,
  social,
  copyright,
  year,
  legal,
  variant = "plain",
  headingLevel = 2,
  as = "footer",
  labels: labelsProp,
  classNames,
  className,
  children,
  ...props
}: FooterProps) {
  const labels = useLabels("Footer", DEFAULT_FOOTER_LABELS, labelsProp);
  const columns = elementChildren(children);
  const legalLinks = elementChildren(legal);
  const socialLinks = elementChildren(social);
  const lead = Boolean(brand || newsletter);
  const top = lead || columns.length > 0;
  const copyrightText = copyright ? labels.copyright(copyright, year ?? new Date().getFullYear()) : null;
  const end = socialLinks.length > 0 || Boolean(localeSwitcher);
  const bottom = Boolean(copyrightText) || legalLinks.length > 0 || end;

  return (
    <Section
      as={as}
      padding="section-2"
      variant={variant}
      className={cn("@container", variant === "plain" && "border-t", className)}
      {...props}
    >
      <Container className={cn("flex flex-col gap-section-2", classNames?.container)}>
        {top && (
          <div
            data-print="hide"
            className={cn("grid gap-section-2", lead && columns.length > 0 && "@5xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]", classNames?.top)}
          >
            {lead && (
              <div className="flex min-w-0 flex-col gap-r2">
                {brand && <div className={cn("min-w-0 [overflow-wrap:anywhere] text-body-2 text-fg-secondary", classNames?.brand)}>{brand}</div>}
                {newsletter && <div className={cn("min-w-0", classNames?.newsletter)}>{newsletter}</div>}
              </div>
            )}
            {columns.length > 0 && (
              <HeadingLevel value={headingLevel}>
                <div
                  className={cn(
                    "grid min-w-0 content-start @max-md:divide-y @max-md:border-y @md:grid-cols-[repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))] @md:gap-r2",
                    classNames?.columns,
                  )}
                >
                  {columns}
                </div>
              </HeadingLevel>
            )}
          </div>
        )}
        {bottom && (
          <div
            className={cn(
              "flex min-w-0 flex-wrap items-center justify-between gap-x-r2 gap-y-r3",
              top && "border-t pt-r2",
              classNames?.bottom,
            )}
          >
            {(copyrightText || legalLinks.length > 0) && (
              <div className="flex min-w-0 flex-wrap items-center gap-x-r2 gap-y-r6">
                {copyrightText && (
                  <p className={cn("min-w-0 [overflow-wrap:anywhere] text-body-3 text-fg-muted", classNames?.copyright)}>{copyrightText}</p>
                )}
                {legalLinks.length > 0 && (
                  <nav aria-label={labels.legal} className={cn("min-w-0", classNames?.legal)}>
                    <ul className="flex flex-wrap items-center gap-x-r3">
                      {legalLinks.map((link, i) => (
                        <li key={link.key ?? i} className="min-w-0">
                          {link}
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>
            )}
            {end && (
              <div data-print="hide" className="flex min-w-0 max-w-full flex-wrap items-center gap-r3 @md:ms-auto">
                {socialLinks.length > 0 && (
                  <ul
                    aria-label={labels.social}
                    // Pulled out by half the floor's overhang, so the first and last glyphs
                    // line up with the text edges rather than with their items' hit floors.
                    className={cn("mx-[calc((var(--ICON)-var(--HIT-MIN))/2)] flex flex-wrap items-center gap-r6", classNames?.social)}
                  >
                    {socialLinks.map((link, i) => (
                      // Each item is a hit floor wide with its link centred, so neighbours'
                      // hit areas (not DOM siblings, so `hit-area` cannot order them) never overlap.
                      <li key={link.key ?? i} className="flex min-w-hit justify-center">
                        {link}
                      </li>
                    ))}
                  </ul>
                )}
                {localeSwitcher && <div className={cn("min-w-0 max-w-full", classNames?.locale)}>{localeSwitcher}</div>}
              </div>
            )}
          </div>
        )}
      </Container>
    </Section>
  );
}

export type FooterColumnProps = {
  /** The column's heading, which also names its navigation landmark. */
  title: ReactNode;
  /** Open at first in the narrow (accordion) form. Default `false`. Wide, every column is open. */
  defaultOpen?: boolean;
  classNames?: SlotClassNames<"heading" | "toggle" | "list">;
  /** `Footer.Link`s (or any elements), each put in a list item. */
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"nav">, "children" | "title">;

/**
 * A headed group of links: a `nav` named by its heading. In a narrow footer the
 * heading is a disclosure button for the list (`aria-expanded`); in a wide one it
 * is plain text and the list always shows.
 */
function FooterColumn({ title, defaultOpen = false, classNames, className, children, ...props }: FooterColumnProps) {
  const level = useContext(HeadingLevel);
  const Heading: ElementType = `h${level}`;
  const id = useId();
  const titleId = `${id}-title`;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(defaultOpen);
  const links = elementChildren(children);

  return (
    <nav aria-labelledby={titleId} className={cn("min-w-0", className)} {...props}>
      <Heading className={cn("text-h6 text-fg-primary", classNames?.heading)}>
        {/* The landmark's name: hidden in the narrow form, where it still names the nav. */}
        <span id={titleId} className="block [overflow-wrap:anywhere] @max-md:hidden">
          {title}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((was) => !was)}
          className={cn(
            "group hidden min-h-row w-full cursor-pointer items-center justify-between gap-r4 px-r4 text-start transition-colors hover:bg-fg-primary/8 @max-md:flex",
            classNames?.toggle,
          )}
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
          <ChevronDown aria-hidden className="size-icon shrink-0 text-fg-muted transition-transform duration-normal group-aria-expanded:rotate-180" />
        </button>
      </Heading>
      <ul
        id={listId}
        className={cn("flex flex-col gap-r6 @md:mt-r4 @max-md:px-r4 @max-md:pb-r3", !open && "@max-md:hidden", classNames?.list)}
      >
        {links.map((link, i) => (
          <li key={link.key ?? i} className="min-w-0">
            {link}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export type FooterLinkProps<C extends ElementType = "a"> = LinkProps<C>;

/**
 * A footer link: `Link` in the surrounding ink, a hit floor tall (stacked links
 * are a floor apart). Internal hrefs go through the `RouterProvider`.
 */
function FooterLink<C extends ElementType = "a">({ className, ...props }: FooterLinkProps<C>) {
  const linkProps = {
    variant: "inherit",
    // A list of destinations in a named navigation: no underline at rest (the list says
    // "links"), the ink firming and the underline under the pointer, like a nav row.
    className: cn(
      "inline-flex min-h-hit max-w-full items-center [overflow-wrap:anywhere] text-body-2 text-fg-secondary no-underline hover:text-fg-primary",
      className,
    ),
    ...props,
  } as LinkProps<C>;
  return <Link<C> {...linkProps} />;
}

export type FooterSocialLinkProps = {
  /** The link's name (`aria-label` and the native `title` hint): "GitHub". Required: the icon says nothing. */
  label: string;
  /** The glyph, sized to `--ICON`. Rendered `aria-hidden`. */
  icon: ReactNode;
  href: string;
} & Omit<LinkProps<"a">, "children" | "external" | "variant" | "href" | "aria-label" | "as">;

/** An icon-only link to a social profile, named by `label`, with a hit area of at least `--HIT-MIN`. */
function FooterSocialLink({ label, icon, className, ...props }: FooterSocialLinkProps) {
  return (
    <Link
      variant="inherit"
      external={false}
      aria-label={label}
      title={label}
      className={cn(
        "hit-area inline-flex items-center justify-center rounded-md p-r5 text-fg-secondary transition-colors hover:bg-fg-primary/8 hover:text-fg-primary hover:no-underline",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="r-marketing-footer-social-icon">
        {icon}
      </span>
    </Link>
  );
}

/** Compound: `Footer` with `Footer.Column`, `Footer.Link` and `Footer.SocialLink`. */
export const Footer = Object.assign(FooterRoot, { Column: FooterColumn, Link: FooterLink, SocialLink: FooterSocialLink });
