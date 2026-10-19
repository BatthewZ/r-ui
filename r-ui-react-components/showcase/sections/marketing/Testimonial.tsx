import { Hexagon, Waves } from "lucide-react";

import { Carousel, Grid, type LocaleLabels, LocaleProvider, Testimonial } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Testimonial",
  group: "marketing",
  order: 61,
  description:
    "A customer's words as a figure: a blockquote in the language's own quotation marks and a caption with the avatar (initials when there is no photo), name, role and company; the source, when there is one, is the <cite>. Optional logo and read-only Rating. Card, pull-quote and compact variants; a grid of them is Grid, a row of them is the Carousel.",
};

// A tiny inline PNG portrait, so the demo needs no network. (An SVG data URL
// would be refused by safeUrl: SVG can carry script.)
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAABaklEQVR42u3U2U7CYBCG4e/SPPYavJvurQmCiKKIIBRK3XdxwX25LE3+hjQpLZ0J0DExeY6/eY8G3+GqKPgaeKLgM/BEwUfgiYL3vicK3nquKPKCXn1XFLz4rih47rqi4KnjiIJRx2FbWV5Kw97EaN/hyaiJmlizeGw7DFNrFMYyHtoOVc4ahTqO+5ZNQqpRSPu4a9kkjCDSPoZ7NgkjiLSPYdMm4QRR9nHbtEkYQaR93OxaJIwg0j6uGxYJI4i0j6uGRcIIIu3jcsciYQSR9slB1CbqOC62TYacNYxlnNdNnqk1vFmc1U22jBr2Jk63TFFwsmmIIi/ouGaIgqOaIQoON4w8GA86Kc8hHFT1bDNJics+h7CqZ5h5jZJxEeG6nmZONVFTylEMKvpEc61RJt5FUNGTFlCjJE+jX9biFpYSFw9Ar6yNFVKjjBvgr2lKgTWKyoBf0n4VXhM1lTR0xdQoEFXzH/QXg34AOrexHWhowWAAAAAASUVORK5CYII=";

/** A wordmark: a decorative mark beside the company's name, which is the logo's text. */
function Logo({ name, mark }: { name: string; mark: "hexagon" | "waves" }) {
  const Mark = mark === "hexagon" ? Hexagon : Waves;
  return (
    <span className="inline-flex items-center gap-r6 text-body-2 font-semibold">
      <Mark aria-hidden className="size-icon" />
      {name}
    </span>
  );
}

const QUOTES = [
  {
    quote: "We used to skip release notes whenever we were busy, which was always. Now they ship with the release.",
    name: "Lena Hoffmann",
    role: "Product Lead",
    company: "Marrow & Fig",
  },
  {
    quote: "Our release notes used to be a list of ticket numbers. Now sales forwards them to customers without editing.",
    name: "Daniel Osei",
    role: "Engineering Manager",
    company: "Halden Labs",
    avatar: PHOTO,
  },
  {
    quote: "Approval before publishing was the feature that got legal to say yes.",
    name: "Sofia Marchetti",
    role: "Compliance Lead",
    company: "Corvid Health",
  },
  {
    quote: "We publish to the docs, the app and email from one draft. That used to be three people and an afternoon.",
    name: "Kenji Watanabe",
    role: "Developer Relations",
    company: "Tessellate",
  },
  {
    quote: "The editor learned our house style in about four releases. Now the first draft is usually the last one.",
    name: "Amara Nwosu",
    role: "Technical Writer",
    company: "Brightwater Freight",
  },
];

const ARABIC: LocaleLabels = {
  Testimonial: { rating: (value, max) => `التقييم ${value} من ${max}`, affiliation: (role, company) => `${role}، ${company}` },
};

export default function TestimonialSection() {
  return (
    <Stack>
      <Row label="Card (rating, logo, source cited) · pull-quote on the display scale · compact (icon avatar, one attribution line)">
        <div className="@container" data-sc="testimonial-variants">
          <div className="grid items-start gap-r2 @3xl:grid-cols-3">
            <Testimonial
              quote="Approval before publishing was the feature that got legal to say yes."
              name="Sofia Marchetti"
              role="Compliance Lead"
              company="Corvid Health"
              rating={4.5}
              logo={<Logo name="Corvid Health" mark="waves" />}
              source="Case study, 2026"
              sourceUrl="https://example.com/customers/corvid"
            />
            <Testimonial
              variant="pull"
              quote="Now the first draft is usually the last one."
              name="Amara Nwosu"
              role="Technical Writer"
              company="Brightwater Freight"
            />
            <Testimonial
              variant="compact"
              quote="Sales forwards our notes to customers without editing."
              name="Daniel Osei"
              role="Engineering Manager"
              company="Halden Labs"
              avatar={PHOTO}
              rating={5}
            />
          </div>
        </div>
      </Row>
      <Row label="A grid of cards: the layout group’s Grid (auto-fit columns), each card stretched by its row so the attributions line up">
        <Grid as="ul" role="list" minColumn="md" gap="r2" data-sc="testimonial-grid">
          {QUOTES.slice(0, 3).map((q) => (
            <li key={q.name} className="flex min-w-0">
              <Testimonial {...q} className="flex-1" />
            </li>
          ))}
        </Grid>
      </Row>
      <Row label="In the Carousel: one to three per view by its width">
        <div data-sc-scrolls="" data-sc="testimonial-carousel">
          <Carousel label="What customers say" perView={3}>
            {QUOTES.map((q) => (
              <Carousel.Slide key={q.name} className="flex">
                <Testimonial {...q} className="flex-1" />
              </Carousel.Slide>
            ))}
          </Carousel>
        </div>
      </Row>
      <Row label="Long content and edge cases: several paragraphs, an unbroken word, no avatar, only a company, a broken photo (initials, silently)">
        <div className="@container">
          <div className="grid items-start gap-r2 @3xl:grid-cols-3" data-sc="testimonial-long">
            <Testimonial
              quote={
                <>
                  <p>We tried three tools before this one. Each wrote the notes for us; none wrote them the way we would.</p>
                  <p>This one learned our voice, and Veröffentlichungsfreigabeverfahrensverwaltung stopped being a meeting.</p>
                </>
              }
              name="Maximiliane Oberhausen-Wittgenstein"
              role="Leiterin Produktkommunikation"
              company="Unternehmenskommunikationsplattform GmbH"
            />
            <Testimonial quote="Short and true." name="Quillstone" company="Quillstone" avatar={false} />
            <Testimonial
              quote="Initials stand in when the photo cannot be decoded."
              name="Broken Image"
              role="Tester"
              avatar="data:image/png;base64,AAAA"
            />
          </div>
        </div>
      </Row>
      <Row label="Quotation marks follow the language (German „…“) · compact density subtree · RTL in Arabic («…», the caption on the inline start)">
        <div className="@container">
          <div className="grid items-start gap-r2 @3xl:grid-cols-3">
            <div lang="de" data-sc="testimonial-german">
              <Testimonial
                quote="Seit wir umgestellt haben, schreibt niemand mehr Changelogs von Hand."
                name="Jonas Weber"
                role="CTO"
                company="Lumen Rail"
                logo={<Logo name="Lumen Rail" mark="hexagon" />}
              />
            </div>
            <div data-density="compact" data-sc="testimonial-compact">
              <Testimonial {...QUOTES[3]!} rating={4} />
            </div>
            <LocaleProvider locale="ar" dir="rtl" labels={ARABIC}>
              <div data-sc="testimonial-rtl">
                <Testimonial
                  quote="ننشر الآن إلى المستندات والتطبيق والبريد من مسودة واحدة."
                  name="ليلى حداد"
                  role="مديرة المنتج"
                  company="مرسى"
                  rating={5}
                />
              </div>
            </LocaleProvider>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
