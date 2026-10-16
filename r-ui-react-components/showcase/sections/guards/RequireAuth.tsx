import { useEffect, useRef, useState } from "react";

import { Switch } from "../../../src/components/form";
import { type AuthStatus, RequireAuth } from "../../../src/components/guards";
import { Grid } from "../../../src/components/layout";
import { Button, Card, Skeleton } from "../../../src/components/primitives";
import { DemoRouter } from "../navigation/parts/demo-router";
import { Row } from "../navigation/parts/demo";

export const meta = {
  title: "RequireAuth",
  group: "guards",
  order: 10,
  description:
    "A gate that knows no router and no auth library. Flip the status: loading shows a wait and never the payroll; signed out shows a sign-in link through the RouterProvider and calls onUnauthenticated once (an app redirects there; this demo counts); authorize refuses a non-admin. Simulate sign-in passes through loading first.",
};

const STATUSES: AuthStatus[] = ["loading", "unauthenticated", "authenticated"];
const FRAME = "grid min-h-[calc(var(--CONTROL-H)*4)] min-w-0 rounded-lg border bg-surface-1";

export default function RequireAuthSection() {
  const [status, setStatus] = useState<AuthStatus>("unauthenticated");
  const [admin, setAdmin] = useState(true);
  const [redirects, setRedirects] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const signIn = () => {
    clearTimeout(timer.current);
    setStatus("loading");
    timer.current = setTimeout(() => setStatus("authenticated"), 1200);
  };

  return (
    <DemoRouter initial="/payroll">
      {(location) => (
        <Grid columns={{ base: 1, "@2xl": 2 }} gap="r1">
          <Row label="Status (the demo's auth state)">
            <div className="grid min-w-0 gap-r4">
              <div role="group" aria-label="Auth status" className="flex flex-wrap gap-r5">
                {STATUSES.map((s) => (
                  <Button
                    key={s}
                    variant="secondary"
                    aria-pressed={status === s}
                    data-sc-status-button={s}
                    onClick={() => {
                      clearTimeout(timer.current);
                      setStatus(s);
                    }}
                  >
                    {s}
                  </Button>
                ))}
                <Button data-sc="auth-sign-in" onClick={signIn}>
                  Simulate sign-in
                </Button>
              </div>
              <Switch checked={admin} onCheckedChange={setAdmin}>
                Signed-in user is an admin (authorize)
              </Switch>
              <output className="text-body-2 text-fg-secondary">
                Location: {location.pathname} · redirects asked for: {redirects}
              </output>
            </div>
          </Row>

          <Row label="The gate">
            <div data-sc="auth-gate" data-status={status} className={FRAME}>
              <RequireAuth
                status={status}
                authorize={() => admin}
                signInHref="/sign-in"
                onUnauthenticated={() => setRedirects((n) => n + 1)}
                className="place-self-center"
              >
                <Card data-sc="auth-secret" className="m-r4">
                  <p className="text-h5">Payroll, October</p>
                  <p className="text-body-1 text-fg-secondary">42 people · paid on the 28th</p>
                </Card>
              </RequireAuth>
            </div>
          </Row>

          <Row label="Translated labels">
            <div className={FRAME}>
              <RequireAuth
                status="unauthenticated"
                signInHref="/anmelden"
                labels={{ signInTitle: "Bitte melden Sie sich an", signInBody: "Diese Seite ist nur für Mitglieder sichtbar.", signIn: "Anmelden" }}
                className="place-self-center"
              >
                <p>Mitgliederbereich</p>
              </RequireAuth>
            </div>
          </Row>

          <Row label="A card-sized gate whose wait is the caller's Skeleton">
            <Card className="min-w-0">
              <RequireAuth status="loading" loadingFallback={<Skeleton lines={3} label="Loading your invoices" />}>
                <p>Invoices</p>
              </RequireAuth>
            </Card>
          </Row>

          <Row label="Refused by authorize (a viewer opening the admin area)">
            <div className={FRAME}>
              <RequireAuth status="authenticated" authorize={() => false} className="place-self-center">
                <p>Admin area</p>
              </RequireAuth>
            </div>
          </Row>
        </Grid>
      )}
    </DemoRouter>
  );
}
