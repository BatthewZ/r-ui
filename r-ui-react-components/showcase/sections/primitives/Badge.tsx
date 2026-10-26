import { CircleCheck, Sparkles } from "lucide-react";

import { Badge, StatusLabel, type Tone } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Badge & StatusLabel",
  group: "primitives",
  order: 20,
  components: ["StatusLabel"],
  description:
    "Badge: every tone × subtle / solid / outline, each a contract pair. StatusLabel: mark-coloured glyph + words, never colour alone.",
};

const TONES: Tone[] = ["neutral", "accent", "info", "success", "warning", "error", "serious", "stale"];
const LABEL: Record<Tone, string> = {
  neutral: "Draft",
  accent: "Current",
  info: "Beta",
  success: "Healthy",
  warning: "Degraded",
  error: "Failed",
  serious: "P1 incident",
  stale: "12 min old",
};

export default function BadgeSection() {
  return (
    <Stack>
      <Row label="Tone × variant">
        <div className="overflow-x-auto" data-sc-scrolls>
          <table className="border-separate border-spacing-0 text-body-2">
            <thead>
              <tr className="text-start text-body-3 text-fg-muted">
                <th className="pe-r3 pb-r4 text-start font-medium">tone</th>
                <th className="pe-r3 pb-r4 text-start font-medium">subtle</th>
                <th className="pe-r3 pb-r4 text-start font-medium">solid</th>
                <th className="pe-r3 pb-r4 text-start font-medium">outline</th>
                <th className="pb-r4 text-start font-medium">StatusLabel</th>
              </tr>
            </thead>
            <tbody>
              {TONES.map((tone) => (
                <tr key={tone}>
                  <td className="pe-r3 pb-r4 text-fg-secondary">{tone}</td>
                  <td className="pe-r3 pb-r4">
                    <Badge tone={tone} variant="subtle">
                      {LABEL[tone]}
                    </Badge>
                  </td>
                  <td className="pe-r3 pb-r4">
                    <Badge tone={tone} variant="solid">
                      {LABEL[tone]}
                    </Badge>
                  </td>
                  <td className="pe-r3 pb-r4">
                    <Badge tone={tone} variant="outline">
                      {LABEL[tone]}
                    </Badge>
                  </td>
                  <td className="pb-r4">
                    <StatusLabel tone={tone}>{LABEL[tone]}</StatusLabel>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Row>

      <Row label="With an icon · counts (tabular) · long text truncates with a title">
        <div className="flex flex-wrap items-center gap-r4">
          <Badge tone="success" icon={<CircleCheck />}>
            Verified
          </Badge>
          <Badge tone="accent" variant="solid" icon={<Sparkles />}>
            New
          </Badge>
          <Badge>1,284</Badge>
          <Badge tone="error" variant="solid">
            99+
          </Badge>
          <div className="w-1/3 min-w-0">
            <Badge tone="info">Infrastructure-as-code migration (phase two)</Badge>
          </div>
        </div>
      </Row>

      <Row label="StatusLabel in rows, compact, truncated, RTL">
        <div className="grid gap-r3 @md:grid-cols-3">
          <ul className="grid gap-r5">
            <li><StatusLabel tone="success">Operational</StatusLabel></li>
            <li><StatusLabel tone="serious">Partial outage in eu-west-1</StatusLabel></li>
            <li><StatusLabel tone="stale">Last seen 3 h ago</StatusLabel></li>
          </ul>
          <ul data-density="compact" className="grid gap-r5">
            <li><StatusLabel tone="warning">Compact: degraded</StatusLabel></li>
            <li className="w-1/2 min-w-0">
              <StatusLabel tone="error">Synchronisation des données échouée après trois tentatives</StatusLabel>
            </li>
          </ul>
          <ul dir="rtl" className="grid gap-r5">
            <li><StatusLabel tone="success">يعمل</StatusLabel></li>
            <li><Badge tone="warning" variant="outline">متدهور</Badge></li>
          </ul>
        </div>
      </Row>
    </Stack>
  );
}

