import { HowItWorks } from "../../../src";
import kiln from "../../pages/marketing/art/kiln.svg";
import pages from "../../pages/marketing/art/pages.svg";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "HowItWorks",
  group: "marketing",
  order: 130,
  description:
    "Numbered steps as an ordered list, in the Stepper's visual language (its marker ring and size), with no current step. A row joined by a line once the list's OWN container fits its steps, a column joined by a vertical line below that; optional media per step; compact and RTL.",
};

const STEPS = [
  { title: "Connect a repository", body: "Pick the repositories to watch. Nothing is written back to them." },
  { title: "Merge as usual", body: "Each merged pull request becomes a draft line, sorted by audience." },
  { title: "Review the draft", body: "Edit lines in place; a reviewer signs off before anything ships." },
  { title: "Publish", body: "One click sends it to the changelog, the in-app panel and email." },
];

const Art = ({ src }: { src: string }) => (
  <img src={src} alt="" width={1600} height={900} className="aspect-video w-full rounded-md border object-cover" />
);

export default function HowItWorksSection() {
  return (
    <Stack>
      <Row label="Four steps · a row here (the list is wide enough, @3xl), a column when the demo is narrower">
        <HowItWorks label="How it works" headingLevel={4} data-sc="how-wide">
          {STEPS.map(({ title, body }) => (
            <HowItWorks.Step key={title} title={title}>
              {body}
            </HowItWorks.Step>
          ))}
        </HowItWorks>
      </Row>
      <Row label="The same four steps in a narrow column: a vertical list, whatever the window">
        <div className="max-w-column-lg" data-sc="how-narrow">
          <HowItWorks label="How it works, narrow" headingLevel={4}>
            {STEPS.map(({ title, body }) => (
              <HowItWorks.Step key={title} title={title}>
                {body}
              </HowItWorks.Step>
            ))}
          </HowItWorks>
        </div>
      </Row>
      <Row label="Three steps with media, always a column (orientation vertical) · compact density (markers and gaps follow it)">
        <div data-density="compact" className="max-w-measure">
          <HowItWorks label="Setting up" headingLevel={4} orientation="vertical">
            <HowItWorks.Step title="Install" media={<Art src={kiln} />}>
              Add the app to your organisation.
            </HowItWorks.Step>
            <HowItWorks.Step title="Choose audiences-and-their-very-long-names-that-wrap" media={<Art src={pages} />}>
              Say who reads what.
            </HowItWorks.Step>
            <HowItWorks.Step title="Ship">Release as usual.</HowItWorks.Step>
          </HowItWorks>
        </div>
      </Row>
      <Row label="RTL · in a row the line runs from right to left">
        <div dir="rtl" data-sc="how-rtl">
          <HowItWorks label="كيف يعمل" headingLevel={4}>
            <HowItWorks.Step title="اربط المستودع">اختر المستودعات التي تريد متابعتها.</HowItWorks.Step>
            <HowItWorks.Step title="ادمج كالمعتاد">يصبح كل طلب دمج سطرًا في المسودة.</HowItWorks.Step>
            <HowItWorks.Step title="انشر">بنقرة واحدة.</HowItWorks.Step>
          </HowItWorks>
        </div>
      </Row>
    </Stack>
  );
}
