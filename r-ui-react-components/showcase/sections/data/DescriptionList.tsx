import type { ReactNode } from "react";

import { DescriptionList, StatusLabel } from "../../../src";
import { formatBytes, formatNumber, MISSING } from "../../../src/util/format";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "DescriptionList",
  group: "data",
  order: 70,
  description:
    "Term / value pairs. A size container: terms stack above values in a narrow box and take a column once the list itself is wide enough (the @sm container step).",
};

function Details({ variant }: { variant: "plain" | "divided" }) {
  return (
    <DescriptionList variant={variant}>
      <DescriptionList.Item term="Service">checkout</DescriptionList.Item>
      <DescriptionList.Item term="Status">
        <StatusLabel tone="serious">Degraded since 14:02</StatusLabel>
      </DescriptionList.Item>
      <DescriptionList.Item term="Region">eu-west-1 (Ireland)</DescriptionList.Item>
      <DescriptionList.Item term="Requests (24h)">{formatNumber(2_310_442)}</DescriptionList.Item>
      <DescriptionList.Item term="Image size">{formatBytes(734_003_200)}</DescriptionList.Item>
      <DescriptionList.Item term="Owner">{MISSING}</DescriptionList.Item>
      <DescriptionList.Item term="Image">
        registry.example.com/payments/checkout-service@sha256:9f2c1e7a4b3d5c6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6
      </DescriptionList.Item>
    </DescriptionList>
  );
}

export default function DescriptionListSection() {
  return (
    <div className="grid grid-cols-1 gap-r1 @3xl:grid-cols-[2fr_1fr]">
      <Demo title="Divided, wide">
        <Details variant="divided" />
      </Demo>
      <Demo title="Plain, narrow">
        <Details variant="plain" />
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <DemoLabel>{title}</DemoLabel>
      {children}
    </div>
  );
}
