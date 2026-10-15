import { Bell, CreditCard, KeyRound, Palette, Plug, User, Users } from "lucide-react";
import { type MouseEvent, useState } from "react";

import { Grid, Stack } from "../../../src/components/layout";
import { NavList } from "../../../src/components/navigation";
import { Row } from "./parts/demo";

export const meta = {
  title: "NavList",
  group: "navigation",
  order: 50,
  description:
    "A vertical list of links for settings and docs pages, flat or in titled sections; the current link carries the accent marker. Rows are --CONTROL-H tall, so they meet the hit floor.",
};

const SECTIONS = [
  {
    title: "Account",
    items: [
      { id: "profile", label: "Profile", Icon: User },
      { id: "security", label: "Password and authentication", Icon: KeyRound, badge: "2" },
      { id: "notifications", label: "Notifications", Icon: Bell },
    ],
  },
  {
    title: "Workspace",
    items: [
      { id: "members", label: "Members", Icon: Users },
      { id: "billing", label: "Billing", Icon: CreditCard },
      { id: "integrations", label: "Integrations and webhooks for third-party tools", Icon: Plug },
      { id: "appearance", label: "Appearance", Icon: Palette },
    ],
  },
];

export default function NavListSection() {
  const [current, setCurrent] = useState("security");
  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setCurrent(id);
  };
  return (
    <Grid columns={{ base: 1, "@xl": 2 }} gap="r1">
      <Row label="Sections · icons · badge · long labels wrap">
        <NavList label="Settings" className="max-w-measure">
          {SECTIONS.map((s) => (
            <NavList.Section key={s.title} title={s.title}>
              {s.items.map(({ id, label, Icon, ...rest }) => (
                <NavList.Item
                  key={id}
                  href={`#${id}`}
                  onClick={go(id)}
                  current={current === id}
                  icon={<Icon aria-hidden />}
                  badge={"badge" in rest ? rest.badge : undefined}
                >
                  {label}
                </NavList.Item>
              ))}
            </NavList.Section>
          ))}
        </NavList>
      </Row>
      <Stack gap="r1">
        <Row label="Flat, text only">
          <NavList label="On this page">
            {["Introduction", "Installation", "Theming", "Density"].map((t, i) => (
              <NavList.Item key={t} href={`#${t}`} current={i === 2} onClick={(e) => e.preventDefault()}>
                {t}
              </NavList.Item>
            ))}
          </NavList>
        </Row>
        <Row label="Right-to-left">
          <div dir="rtl">
            <NavList label="On this page">
              {["Introduction", "Installation", "Theming"].map((t, i) => (
                <NavList.Item key={t} href={`#${t}`} current={i === 1} onClick={(e) => e.preventDefault()}>
                  {t}
                </NavList.Item>
              ))}
            </NavList>
          </div>
        </Row>
      </Stack>
    </Grid>
  );
}
