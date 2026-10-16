import { Avatar, AvatarGroup, type AvatarGroupItem, Button } from "../../../src/components/primitives";
import { Popover } from "../../../src/components/overlays";
import { LocaleProvider, type LocaleLabels } from "../../../src/util/locale";
import { cn } from "../../../src/util/style";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "AvatarGroup",
  group: "primitives",
  order: 71,
  description:
    "Overlapping avatars as a list named by its label, each face named by its person. Past max the last circle is “+n”, whose spoken text names who it stands for; renderOverflow turns it into a control of your own (here a Popover listing the rest). Sizes are Avatar's, so faces follow density and reach the coarse hit floor.",
};

// A tiny inline PNG portrait, so the demo needs no network (as in the Avatar demo).
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAABaklEQVR42u3U2U7CYBCG4e/SPPYavJvurQmCiKKIIBRK3XdxwX25LE3+hjQpLZ0J0DExeY6/eY8G3+GqKPgaeKLgM/BEwUfgiYL3vicK3nquKPKCXn1XFLz4rih47rqi4KnjiIJRx2FbWV5Kw97EaN/hyaiJmlizeGw7DFNrFMYyHtoOVc4ahTqO+5ZNQqpRSPu4a9kkjCDSPoZ7NgkjiLSPYdMm4QRR9nHbtEkYQaR93OxaJIwg0j6uGxYJI4i0j6uGRcIIIu3jcsciYQSR9slB1CbqOC62TYacNYxlnNdNnqk1vFmc1U22jBr2Jk63TFFwsmmIIi/ouGaIgqOaIQoON4w8GA86Kc8hHFT1bDNJics+h7CqZ5h5jZJxEeG6nmZONVFTylEMKvpEc61RJt5FUNGTFlCjJE+jX9biFpYSFw9Ar6yNFVKjjBvgr2lKgTWKyoBf0n4VXhM1lTR0xdQoEFXzH/QXg34AOrexHWhowWAAAAAASUVORK5CYII=";

const TEAM: AvatarGroupItem[] = [
  { name: "Ada Lovelace", src: PHOTO },
  { name: "Grace Hopper" },
  { name: "Alan Turing" },
  { name: "Katherine Johnson" },
  { name: "Edsger Dijkstra" },
  { name: "Barbara Liskov" },
  { name: "Margaret Hamilton" },
  { name: "Donald Knuth" },
  { name: "Frances Allen" },
];

const LONG: AvatarGroupItem[] = [
  { name: "Maximilian Alexander von Hohenzollern-Sigmaringen" },
  { name: "Oluwaseun Adebayo-Ogunleye" },
  { name: "Broken Image", src: "data:image/png;base64,AAAA" },
];

/** Module scope: a provider's labels object must stay stable. */
const ARABIC: LocaleLabels = {
  AvatarGroup: { more: (n) => `+${n}`, moreNames: (n, names) => `${n} آخرون: ${names.join("، ")}` },
};

/** The surplus as a button that lists everyone not shown. */
function TeamWithPopover() {
  return (
    <AvatarGroup
      label="On call this week"
      items={TEAM}
      max={5}
      data-sc="avatar-group-popover"
      renderOverflow={(overflow) => (
        <Popover placement="bottom-start">
          <Popover.Trigger asChild>
            <button type="button" className={cn(overflow.className, "cursor-pointer hover:border-border-strong")} aria-label={overflow.label}>
              <span aria-hidden className={overflow.textClassName}>
                {overflow.text}
              </span>
            </button>
          </Popover.Trigger>
          <Popover.Content aria-label="Also on call" className="w-column-sm">
            <ul className="grid gap-r5">
              {overflow.items.map((item) => (
                <li key={item.name} className="flex min-w-0 items-center gap-r4 text-body-1">
                  <Avatar size="icon" src={item.src} name={item.name} alt="" />
                  <span className="min-w-0 break-words">{item.name}</span>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover>
      )}
    />
  );
}

export default function AvatarGroupSection() {
  return (
    <Stack>
      <Row label="Team of nine, max 5: four faces and a “+5” count (spoken with the names) · everyone, no max">
        <div className="grid gap-r4">
          <AvatarGroup label="Team" items={TEAM} max={5} data-sc="avatar-group-count" />
          <AvatarGroup label="Whole team" items={TEAM} />
        </div>
      </Row>
      <Row label="renderOverflow: the “+5” is a button opening a Popover with the rest">
        <TeamWithPopover />
      </Row>
      <Row label="Icon size inline in a row · compact subtree · long names, a broken image · none assigned · RTL">
        <div className="grid gap-r4">
          <div className="flex min-w-0 flex-wrap items-center gap-r4 text-body-1">
            <span>Reviewers</span>
            <AvatarGroup label="Reviewers" items={TEAM.slice(0, 6)} max={4} size="icon" />
            <Button variant="ghost">Request review</Button>
          </div>
          <div data-density="compact" className="flex items-center gap-r4">
            <AvatarGroup label="Compact team" items={TEAM} max={6} />
          </div>
          <AvatarGroup label="Authors" items={LONG} />
          <div className="flex items-center gap-r4 text-body-2 text-fg-muted">
            <AvatarGroup label="Assignees" items={[]} />
            No one assigned yet.
          </div>
          <LocaleProvider dir="rtl" locale="ar" labels={ARABIC}>
            <AvatarGroup label="الفريق" items={TEAM} max={4} />
          </LocaleProvider>
        </div>
      </Row>
    </Stack>
  );
}
