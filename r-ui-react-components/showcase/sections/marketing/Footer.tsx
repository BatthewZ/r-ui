import { Github, Linkedin, Rss, Youtube } from "lucide-react";
import { useState } from "react";

import { EmailCapture, Footer, LocaleProvider, type LocaleLabels, Select } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Footer",
  group: "marketing",
  order: 95,
  description:
    "A site footer: brand and newsletter (an EmailCapture), link columns (each a navigation landmark named by its heading), and a legal row with social links and a locale switcher. Below the md container step (the FOOTER's width, not the viewport's), the columns fold into an accordion. The locale switcher here is a Select bound to a LocaleProvider: the footer's own words, and the demo's, follow it. Printed, only the legal row remains.",
};

type Lang = "en" | "de" | "ar";

interface Copy {
  brand: string;
  newsletter: { label: string; placeholder: string; submit: string };
  columns: { title: string; links: string[] }[];
  legal: string[];
  language: string;
  labels: LocaleLabels;
}

const COPY: Record<Lang, Copy> = {
  en: {
    brand: "Kiln drafts release notes from your pull requests, grouped by reader.",
    newsletter: { label: "The monthly digest", placeholder: "you@example.com", submit: "Subscribe" },
    columns: [
      { title: "Product", links: ["Features", "Pricing", "Changelog", "Integrations"] },
      { title: "Resources", links: ["Documentation", "Journal", "Field guide", "Status"] },
      { title: "Company", links: ["About", "Careers", "Security", "Contact"] },
    ],
    legal: ["Privacy", "Terms", "Cookie settings"],
    language: "Language",
    labels: {},
  },
  de: {
    brand: "Kiln schreibt Release Notes aus Ihren Pull Requests, nach Lesern gruppiert.",
    newsletter: { label: "Der monatliche Überblick", placeholder: "sie@beispiel.de", submit: "Abonnieren" },
    columns: [
      { title: "Produkt", links: ["Funktionen", "Preise", "Änderungsprotokoll", "Integrationen"] },
      { title: "Ressourcen", links: ["Dokumentation", "Journal", "Leitfaden", "Systemstatus"] },
      { title: "Unternehmen", links: ["Über uns", "Karriere", "Sicherheit", "Kontakt"] },
    ],
    legal: ["Datenschutz", "AGB", "Cookie-Einstellungen"],
    language: "Sprache",
    labels: {
      Footer: {
        legal: "Rechtliches",
        social: "Soziale Medien",
        copyright: (holder, year) => `© ${year} ${holder}. Alle Rechte vorbehalten.`,
      },
    },
  },
  ar: {
    brand: "يكتب Kiln ملاحظات الإصدار من طلبات الدمج، مجمّعة حسب القارئ.",
    newsletter: { label: "الملخص الشهري", placeholder: "you@example.com", submit: "اشتراك" },
    columns: [
      { title: "المنتج", links: ["الميزات", "الأسعار", "سجل التغييرات", "التكاملات"] },
      { title: "الموارد", links: ["التوثيق", "المدونة", "الدليل", "الحالة"] },
      { title: "الشركة", links: ["من نحن", "الوظائف", "الأمان", "اتصل بنا"] },
    ],
    legal: ["الخصوصية", "الشروط", "إعدادات ملفات تعريف الارتباط"],
    language: "اللغة",
    labels: {
      Footer: { legal: "قانوني", social: "وسائل التواصل", copyright: (holder, year) => `© ${year} ${holder}` },
    },
  },
};

const LANGUAGES: { value: Lang; name: string; locale: string }[] = [
  { value: "en", name: "English", locale: "en-GB" },
  { value: "de", name: "Deutsch", locale: "de-DE" },
  { value: "ar", name: "العربية", locale: "ar" },
];

const HREF = "#/overview/marketing-footer";

const SOCIAL = (
  <>
    <Footer.SocialLink href="https://github.com/" label="GitHub" icon={<Github />} />
    <Footer.SocialLink href="https://www.linkedin.com/" label="LinkedIn" icon={<Linkedin />} />
    <Footer.SocialLink href="https://www.youtube.com/" label="YouTube" icon={<Youtube />} />
    <Footer.SocialLink href={HREF} label="RSS feed" icon={<Rss />} />
  </>
);

function Brand({ line }: { line: string }) {
  return (
    <>
      <p className="text-h5 text-fg-primary">Kiln</p>
      <p className="mt-r5 max-w-measure">{line}</p>
    </>
  );
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The newsletter slot holds the library's EmailCapture, its words from the copy. */
function Newsletter({ label, placeholder, submit }: Copy["newsletter"]) {
  return <EmailCapture className="max-w-measure" onSubmit={() => wait(500)} labels={{ email: label, placeholder, submit }} />;
}

/** Arrays, not components: the footer puts each element it is given in its own list item. */
function columnsOf(columns: Copy["columns"]) {
  return columns.map((column) => (
    <Footer.Column key={column.title} title={column.title}>
      {column.links.map((link) => (
        <Footer.Link key={link} href={HREF}>
          {link}
        </Footer.Link>
      ))}
    </Footer.Column>
  ));
}

function legalOf(links: string[]) {
  return links.map((link) => (
    <Footer.Link key={link} href={HREF}>
      {link}
    </Footer.Link>
  ));
}

/** The whole footer under a LocaleProvider that its own locale switcher drives. */
function LocalisedFooter() {
  const [lang, setLang] = useState<Lang>("en");
  const copy = COPY[lang];
  const language = LANGUAGES.find((l) => l.value === lang)!;
  return (
    <LocaleProvider locale={language.locale} labels={copy.labels} dir={lang === "ar" ? "rtl" : "ltr"}>
      <Footer
        brand={<Brand line={copy.brand} />}
        newsletter={<Newsletter {...copy.newsletter} />}
        copyright="Kiln Labs"
        year={2026}
        legal={legalOf(copy.legal)}
        social={SOCIAL}
        localeSwitcher={
          <Select aria-label={copy.language} value={lang} onValueChange={(v) => setLang(v as Lang)} className="w-column-sm max-w-full">
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value} lang={l.locale}>
                {l.name}
              </option>
            ))}
          </Select>
        }
      >
        {columnsOf(copy.columns)}
      </Footer>
    </LocaleProvider>
  );
}

const LONG_COLUMNS: Copy["columns"] = [
  {
    title: "Integrationen und Arbeitsabläufe für Veröffentlichungen",
    links: ["Quelltextverwaltungsplattformintegration", "GitHub", "GitLab", "Bitbucket", "Azure DevOps", "Gitea", "Webhooks"],
  },
  { title: "Resources", links: ["Documentation", "API reference", "Field guide to writing for readers who skim"] },
];

export default function FooterSection() {
  return (
    <Stack>
      <Row label="Marketing footer · brand, an EmailCapture in the newsletter slot, three columns, legal row, social links · a locale switcher bound to a LocaleProvider (try Deutsch, العربية)">
        <div data-sc="footer-full">
          <LocalisedFooter />
        </div>
      </Row>
      <Row label="In a narrow box (--COLUMN-LG wide): the columns fold into an accordion, whatever the viewport">
        <div data-sc="footer-narrow" className="w-column-lg max-w-full">
          <Footer as="div" copyright="Kiln Labs" year={2026} legal={legalOf(COPY.en.legal)} social={SOCIAL}>
            {columnsOf(COPY.en.columns)}
          </Footer>
        </div>
      </Row>
      <Row label="Minimal footer · copyright, legal links and social links only">
        <div data-sc="footer-minimal">
          <Footer as="div" copyright="Kiln Labs" year={2026} legal={legalOf(COPY.en.legal)} social={SOCIAL} />
        </div>
      </Row>
      <Row label="Band variant · compact density · long titles, long words and many links · heading level 3">
        <div data-sc="footer-long" data-density="compact">
          <Footer
            as="div"
            variant="band"
            headingLevel={3}
            brand={<Brand line="Eine sehr lange Markenbeschreibung, die umbricht: Veröffentlichungshinweisverfassungsassistent." />}
            copyright="Kiln Labs Gesellschaft mit beschränkter Haftung und Compagnie Kommanditgesellschaft"
            year={2026}
            legal={legalOf(COPY.de.legal)}
          >
            {columnsOf(LONG_COLUMNS)}
          </Footer>
        </div>
      </Row>
      <Row label="RTL (Arabic) · labels from the instance">
        <div data-sc="footer-rtl" dir="rtl" lang="ar">
          <Footer as="div" copyright="Kiln Labs" year={2026} labels={COPY.ar.labels.Footer} legal={legalOf(COPY.ar.legal)} social={SOCIAL}>
            {columnsOf(COPY.ar.columns)}
          </Footer>
        </div>
      </Row>
    </Stack>
  );
}
