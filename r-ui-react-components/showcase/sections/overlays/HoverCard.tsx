import { BookMarked, Star } from "lucide-react";
import { useState } from "react";

import { Avatar, Button, HoverCard, Link, Skeleton, Table } from "../../../src";
import { formatCompact } from "../../../src/util/format";
import { ClipFrame, Row, Stack } from "./parts/demo";

export const meta = {
  title: "HoverCard",
  group: "overlays",
  order: 25,
  description:
    "A rich preview of a user or a repository: hover or keyboard focus opens it after a delay, the pointer can cross onto it, Tab walks into its buttons, Escape closes it from anywhere, and the link still navigates. On touch, the eye button beside a trigger opens it.",
};

interface User {
  handle: string;
  name: string;
  bio?: string;
  repos: number;
  followers: number;
}

interface Repo {
  slug: string;
  description: string;
  stars: number;
  language: string;
}

const ADA: User = { handle: "ada", name: "Ada Lovelace", bio: "Notes on the analytical engine. Maintains the scheduler.", repos: 128, followers: 48_200 };
const GRACE: User = { handle: "grace", name: "Grace Hopper", bio: "Compilers, nanoseconds and a moth.", repos: 34, followers: 12_900 };
const NEW_USER: User = { handle: "newcomer", name: "Sam Okafor", repos: 0, followers: 0 };
const LONG: User = {
  handle: "maximilianealexandrinahohenzollern-sigmaringen",
  name: "Maximiliane Alexandrina von Hohenzollern-Sigmaringen-Wittelsbach",
  bio: "Infrastructure, observability and the occasional Donaudampfschifffahrtsgesellschaftskapitänsmütze. Writes long commit messages on purpose.",
  repos: 2_431,
  followers: 1_250_000,
};
const RTL_USER: User = { handle: "layla", name: "ليلى حداد", bio: "تصميم الأنظمة وقابلية الوصول.", repos: 57, followers: 3_400 };
const REPO: Repo = { slug: "r-ui/r-ui-css", description: "The token contract and themes, as Tailwind v4 CSS. Zero JavaScript.", stars: 4_820, language: "CSS" };

const userHref = (handle: string) => `#/overview/overlays-hovercard/${handle}`;

function UserCard({ user }: { user: User }) {
  return (
    <div className="grid gap-r4">
      <div className="flex min-w-0 items-center gap-r4">
        <Avatar name={user.name} />
        <div className="grid min-w-0">
          <span className="font-semibold break-words">{user.name}</span>
          <span className="text-body-2 break-words text-fg-secondary">@{user.handle}</span>
        </div>
      </div>
      <p className="text-body-2 break-words text-fg-secondary">{user.bio ?? "No bio yet."}</p>
      <p className="text-body-2 text-fg-secondary">
        {user.repos === 0 ? "No public repositories yet" : `${formatCompact(user.repos)} repositories · ${formatCompact(user.followers)} followers`}
      </p>
      <div className="flex flex-wrap items-center gap-r3">
        <Button variant="secondary">Follow</Button>
        <Link href={`${userHref(user.handle)}-repos`}>Repositories</Link>
      </div>
    </div>
  );
}

function UserHoverCard({ user, toggle = false, testId }: { user: User; toggle?: boolean; testId?: string }) {
  return (
    <HoverCard>
      <HoverCard.Trigger>
        <Link href={userHref(user.handle)} data-testid={testId} className="break-words">
          @{user.handle}
        </Link>
      </HoverCard.Trigger>
      {toggle && <HoverCard.Toggle label={`Preview @${user.handle}`} />}
      <HoverCard.Content>
        <UserCard user={user} />
      </HoverCard.Content>
    </HoverCard>
  );
}

function RepoHoverCard({ repo }: { repo: Repo }) {
  return (
    <HoverCard placement="top">
      <HoverCard.Trigger>
        <Link href={`#/overview/overlays-hovercard/${encodeURIComponent(repo.slug)}`}>{repo.slug}</Link>
      </HoverCard.Trigger>
      <HoverCard.Content>
        <div className="grid gap-r5">
          <span className="flex items-center gap-r6 font-semibold">
            <BookMarked className="size-icon" aria-hidden />
            {repo.slug}
          </span>
          <p className="text-body-2 text-fg-secondary">{repo.description}</p>
          <span className="flex items-center gap-r6 text-body-2 text-fg-secondary">
            {repo.language} · <Star className="size-icon" aria-hidden /> {formatCompact(repo.stars)} stars
          </span>
        </div>
      </HoverCard.Content>
    </HoverCard>
  );
}

const PULLS = [
  { id: 412, title: "Density-aware separators", author: ADA, updated: "2 h ago" },
  { id: 409, title: "Forced-colours edge for the progress track", author: GRACE, updated: "yesterday" },
  { id: 401, title: "First contribution: fix a typo in the README", author: NEW_USER, updated: "3 days ago" },
];

export default function HoverCardSection() {
  const [pinned, setPinned] = useState(false);
  return (
    <Stack>
      <Row label="In running text: a user and a repository (hover, or Tab onto a link and wait)">
        <div className="max-w-measure text-body-1 text-fg-secondary" data-testid="hc-text">
          <UserHoverCard user={ADA} testId="hc-ada" /> merged twelve commits into <RepoHoverCard repo={REPO} /> and
          asked <UserHoverCard user={GRACE} /> for a review before the release.
        </div>
      </Row>

      <Row label="In a table, with a preview button beside each author for touch">
        <div data-testid="hc-table" className="min-w-0">
          <Table aria-label="Open pull requests">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Pull request</Table.HeaderCell>
                <Table.HeaderCell>Author</Table.HeaderCell>
                <Table.HeaderCell priority={2}>Updated</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {PULLS.map((pr) => (
                <Table.Row key={pr.id}>
                  <Table.Cell>
                    #{pr.id} {pr.title}
                  </Table.Cell>
                  <Table.Cell truncate={false}>
                    <span className="inline-flex items-center gap-r6">
                      <UserHoverCard user={pr.author} toggle />
                    </span>
                  </Table.Cell>
                  <Table.Cell priority={2}>{pr.updated}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Row>

      <Row label="Loading, failed and empty previews">
        <div className="flex flex-wrap items-center gap-r3 text-body-1">
          <HoverCard>
            <HoverCard.Trigger>
              <Link href={userHref("loading")}>@loading</Link>
            </HoverCard.Trigger>
            <HoverCard.Content aria-busy>
              <div className="grid gap-r4">
                <div className="flex items-center gap-r4">
                  <Skeleton shape="circle" className="size-control" />
                  <Skeleton lines={2} className="grow" />
                </div>
                <Skeleton lines={2} label="Loading profile" />
              </div>
            </HoverCard.Content>
          </HoverCard>
          <HoverCard>
            <HoverCard.Trigger>
              <Link href={userHref("ghost")}>@ghost</Link>
            </HoverCard.Trigger>
            <HoverCard.Content>
              <div className="grid gap-r5">
                <p className="text-body-2 text-fg-error">Couldn't load @ghost's profile.</p>
                <p className="text-body-2 text-fg-secondary">The link still opens the profile page.</p>
              </div>
            </HoverCard.Content>
          </HoverCard>
          <UserHoverCard user={NEW_USER} />
        </div>
      </Row>

      <Row label="Long name, handle and bio wrap inside the card's column">
        <div className="min-w-0 text-body-1">
          <UserHoverCard user={LONG} />
        </div>
      </Row>

      <Row label="Inside a clipping, compact frame: the card is compact and escapes the clip">
        <ClipFrame label="overflow: hidden · compact" data-density="compact">
          <span className="text-body-1" data-testid="hc-compact">
            <UserHoverCard user={GRACE} />
          </span>
        </ClipFrame>
      </Row>

      <Row label="RTL">
        <div dir="rtl" className="text-body-1" data-testid="hc-rtl">
          راجعت <UserHoverCard user={RTL_USER} toggle /> التغييرات.
        </div>
      </Row>

      <Row label="Controlled: opened by the button, closed by Escape or a press outside">
        <div className="flex flex-wrap items-center gap-r4 text-body-1" data-testid="hc-controlled">
          <Button variant="secondary" onClick={() => setPinned(true)}>
            Open the card
          </Button>
          <HoverCard open={pinned} onOpenChange={setPinned}>
            <HoverCard.Trigger>
              <Link href={userHref("ada")}>@ada</Link>
            </HoverCard.Trigger>
            <HoverCard.Content>
              <UserCard user={ADA} />
            </HoverCard.Content>
          </HoverCard>
        </div>
      </Row>

      <Row label="Disabled: the link stays, no card">
        <div className="text-body-1">
          <HoverCard disabled>
            <HoverCard.Trigger>
              <Link href={userHref("ada")}>@ada</Link>
            </HoverCard.Trigger>
            <HoverCard.Content>
              <UserCard user={ADA} />
            </HoverCard.Content>
          </HoverCard>
        </div>
      </Row>
    </Stack>
  );
}
