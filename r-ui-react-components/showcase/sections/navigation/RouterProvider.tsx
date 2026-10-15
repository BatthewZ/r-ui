import { CreditCard, KeyRound, User } from "lucide-react";

import { Grid, Stack } from "../../../src/components/layout";
import { Breadcrumbs, NavList, Pagination } from "../../../src/components/navigation";
import { Link } from "../../../src/components/primitives";
import { DemoRouter } from "./parts/demo-router";
import { Row } from "./parts/demo";

export const meta = {
  title: "RouterProvider",
  group: "navigation",
  order: 60,
  description:
    "The router is configured once: every link part (Link, NavList.Item, AppShell.NavItem and Brand, Breadcrumbs.Item, Pagination with getHref) renders its link component and asks its isCurrent. No item below passes `as` or `current`; external URLs stay plain links.",
};

const SETTINGS = [
  { href: "/settings/profile", label: "Profile", Icon: User },
  { href: "/settings/security", label: "Security", Icon: KeyRound },
  { href: "/settings/billing", label: "Billing", Icon: CreditCard },
];
const LABEL: Record<string, string> = Object.fromEntries(SETTINGS.map((s) => [s.href, s.label]));

export default function RouterProviderSection() {
  return (
    <DemoRouter initial="/settings/billing?page=2">
      {(location) => {
        const page = Number(location.searchParams.get("page") ?? "1");
        return (
          <Stack gap="r2">
            <Row label="Location (the demo router's state)">
              <code className="text-body-2">
                {location.pathname}
                {location.search}
              </code>
            </Row>
            <Grid columns={{ base: 1, "@2xl": 2 }} gap="r1">
              <Row label="NavList: current from isCurrent(href)">
                <NavList label="Settings (router demo)">
                  {SETTINGS.map(({ href, label, Icon }) => (
                    <NavList.Item key={href} href={href} icon={<Icon aria-hidden />}>
                      {label}
                    </NavList.Item>
                  ))}
                </NavList>
              </Row>
              <Stack gap="r2">
                <Row label="Breadcrumbs: the matching crumb is current">
                  <Breadcrumbs label="Breadcrumb (router demo)">
                    <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
                    <Breadcrumbs.Item href="/settings">Settings</Breadcrumbs.Item>
                    <Breadcrumbs.Item href={location.pathname}>{LABEL[location.pathname] ?? location.pathname}</Breadcrumbs.Item>
                  </Breadcrumbs>
                </Row>
                <Row label="Pagination in link mode: real links, page from the URL">
                  <Pagination
                    labels={{ nav: "Invoices pages" }}
                    pageCount={8}
                    page={page}
                    getHref={(p) => `${location.pathname}?page=${p}`}
                  />
                </Row>
                <Row label="Link: internal via the router, external stays a plain <a>">
                  <p className="text-body-1">
                    <Link href="/settings/profile">Edit your profile</Link> or read the{" "}
                    <Link href="https://example.com/docs" external>
                      docs
                    </Link>
                    .
                  </p>
                </Row>
              </Stack>
            </Grid>
          </Stack>
        );
      }}
    </DemoRouter>
  );
}
