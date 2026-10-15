import { AtSign, Eye, EyeOff, Globe, Link2 } from "lucide-react";
import { useState } from "react";

import { Field, Input } from "../../../src/components/form";
import { IconButton } from "../../../src/components/primitives";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Input",
  group: "form",
  order: 20,
  description:
    "Text-like fields at h-control. Adornments sit inside the frame (icon, prefix, unit, a small button); a press anywhere on the frame focuses the field, and the focus ring wraps the whole frame.",
};

function PasswordField() {
  const [shown, setShown] = useState(false);
  return (
    <Field>
      <Field.Label>API secret</Field.Label>
      <Input
        type={shown ? "text" : "password"}
        defaultValue="sk_live_51HxQ2"
        end={
          <IconButton
            label={shown ? "Hide secret" : "Show secret"}
            icon={shown ? <EyeOff /> : <Eye />}
            onClick={() => setShown((s) => !s)}
          />
        }
      />
    </Field>
  );
}

export default function InputSection() {
  return (
    <Stack>
      <Row label="Plain · placeholder · adornments">
        <Grid>
          <Field>
            <Field.Label>Project</Field.Label>
            <Input defaultValue="Checkout reliability" />
          </Field>
          <Field>
            <Field.Label>Owner</Field.Label>
            <Input type="email" placeholder="name@example.com" start={<AtSign aria-hidden />} />
          </Field>
          <Field>
            <Field.Label>Status page</Field.Label>
            <Input type="url" start={<span className="text-body-1">https://</span>} defaultValue="status.example.com" />
          </Field>
          <Field>
            <Field.Label>Timeout</Field.Label>
            <Input defaultValue="1500" end={<span className="text-body-1">ms</span>} classNames={{ input: "tabular-nums" }} />
          </Field>
          <Field>
            <Field.Label>Endpoint</Field.Label>
            <Input start={<Globe aria-hidden />} end={<Link2 aria-hidden />} defaultValue="api.eu-west-1.example.com" />
          </Field>
          <PasswordField />
        </Grid>
      </Row>

      <Row label="States: invalid · disabled · read-only">
        <Grid>
          <Field>
            <Field.Label>Callback URL</Field.Label>
            <Input defaultValue="htps://hooks.example.com" />
            <Field.Error>Use http:// or https://</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Billing ID</Field.Label>
            <Input defaultValue="cus_Qx91" start={<AtSign aria-hidden />} />
          </Field>
          <Field readOnly>
            <Field.Label>Created by</Field.Label>
            <Input defaultValue="Ada Lovelace" />
          </Field>
        </Grid>
      </Row>

      <Row label="Long value scrolls inside the frame · narrow width · RTL">
        <Grid>
          <Input
            aria-label="Long URL"
            defaultValue="https://grafana.internal.example.com/d/checkout-latency/checkout-latency-p95?orgId=1&from=now-6h&to=now"
          />
          <Input aria-label="Narrow" className="w-1/2" placeholder="Half width" />
          <div dir="rtl">
            <Input aria-label="بحث" start={<AtSign aria-hidden />} end={<span className="text-body-1">ms</span>} defaultValue="١٥٠٠" />
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
