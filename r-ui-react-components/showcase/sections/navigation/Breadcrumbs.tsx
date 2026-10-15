import { Stack } from "../../../src/components/layout";
import { Breadcrumbs } from "../../../src/components/navigation";
import { Row } from "./parts/demo";

export const meta = {
  title: "Breadcrumbs",
  group: "navigation",
  order: 30,
  description:
    "A trail ending on the current page. Over maxItems the middle collapses into one button, which expands in place and moves focus to the first crumb it revealed. Links meet the hit floor without growing.",
};

const TRAIL = [
  { href: "#home", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#payments", label: "Payments" },
  { href: "#eu", label: "eu-west-1" },
  { href: "#api", label: "payments-api-gateway-production-canary" },
];

function Trail({ maxItems }: { maxItems?: number }) {
  return (
    <Breadcrumbs maxItems={maxItems}>
      {TRAIL.map(({ href, label }) => (
        <Breadcrumbs.Item key={href} href={href} onClick={(e) => e.preventDefault()}>
          {label}
        </Breadcrumbs.Item>
      ))}
      <Breadcrumbs.Item current>Deploy #4182</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}

export default function BreadcrumbsSection() {
  return (
    <Stack gap="r1">
      <Row label="Full trail, long names wrap">
        <Trail />
      </Row>
      <Row label="Collapsed (maxItems 4)">
        <Trail maxItems={4} />
      </Row>
      <Row label="Short trail">
        <Breadcrumbs>
          <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
          <Breadcrumbs.Item current>Settings</Breadcrumbs.Item>
        </Breadcrumbs>
      </Row>
      <Row label="Right-to-left">
        <div dir="rtl">
          <Trail maxItems={4} />
        </div>
      </Row>
    </Stack>
  );
}
