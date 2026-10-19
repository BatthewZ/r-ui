import { ArrowRight, Github, Linkedin, Rss, Youtube } from "lucide-react";

import { Button, CallToAction, EmailCapture, Footer, Select } from "../../../src";
import { brandMark } from "../../sections/marketing/parts/site-nav";
import { href } from "../../shell/router";
import { FOOTER_COLUMNS, LEGAL, PRODUCT, type Region, REGIONS } from "./content";

const sendGuide = () => new Promise<void>((resolve) => setTimeout(resolve, 600));

/**
 * The final call to action: the one main action, and under it the field guide
 * for anyone not ready to connect. One column, read top to bottom, so the
 * action sits on the form's start edge rather than at the band's end.
 */
export function ClosingCta() {
  return (
    <CallToAction
      layout="split"
      title="Your next release is already merged. Let it explain itself."
      body={`Connect a repository and ${PRODUCT} drafts your first release note in about a minute. Free for one repository, no card needed.`}
      actions={<Button iconEnd={<ArrowRight />}>Start free</Button>}
      classNames={{ actions: "gap-section-3 @4xl:justify-items-start" }}
    >
      <EmailCapture
        onSubmit={sendGuide}
        description="Not ready to connect a repository? Our field guide to release notes, in one email and nothing after it."
        labels={{
          email: "Get the field guide",
          submit: "Send me the guide",
          successTitle: "The guide is on its way",
          successMessage: (email) => `Look for it at ${email} in a minute or two.`,
        }}
      />
    </CallToAction>
  );
}

interface SiteFooterProps {
  region: Region;
  onRegionChange: (region: Region) => void;
}

const isRegion = (value: string): value is Region => REGIONS.some((r) => r.locale === value);

/** Arrays, not components: the footer puts each element it is given in its own list item. */
export function SiteFooter({ region, onRegionChange }: SiteFooterProps) {
  return (
    <Footer
      aria-label={`${PRODUCT} site`}
      // The closing band above already draws an edge here.
      className="border-t-0"
      brand={
        <>
          {brandMark(href("marketing"), PRODUCT)}
          <p className="mt-r4 max-w-measure">
            Release notes from the work you already did. Made by a small team in Rotterdam and Montréal.
          </p>
        </>
      }
      copyright={`${PRODUCT} Software B.V.`}
      year={2026}
      legal={LEGAL.map((label) => (
        <Footer.Link key={label} href={href("marketing")}>
          {label}
        </Footer.Link>
      ))}
      social={[
        <Footer.SocialLink key="github" href="https://github.com/" label="GitHub" icon={<Github />} />,
        <Footer.SocialLink key="linkedin" href="https://www.linkedin.com/" label="LinkedIn" icon={<Linkedin />} />,
        <Footer.SocialLink key="youtube" href="https://www.youtube.com/" label="YouTube" icon={<Youtube />} />,
        <Footer.SocialLink key="rss" href={href("marketing", "journal")} label="Journal RSS feed" icon={<Rss />} />,
      ]}
      localeSwitcher={
        <Select
          aria-label="Region"
          value={region}
          onValueChange={(value) => isRegion(value) && onRegionChange(value)}
          className="w-column-sm max-w-full"
          data-mkt="region"
        >
          {REGIONS.map(({ locale, name }) => (
            <option key={locale} value={locale} lang={locale}>
              {name}
            </option>
          ))}
        </Select>
      }
    >
      {FOOTER_COLUMNS.map(({ title, links }) => (
        <Footer.Column key={title} title={title}>
          {links.map(({ label, anchor }) => (
            <Footer.Link key={label} href={href("marketing", anchor)}>
              {label}
            </Footer.Link>
          ))}
        </Footer.Column>
      ))}
    </Footer>
  );
}
