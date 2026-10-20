import { Field, Form, FormActions, Input } from "@batthewz/r-ui-react-components";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { RendererAdapters } from "../runtime/adapters";
import type { StreamingState } from "../runtime/context";
import { useViewRuntime, type ViewRuntime } from "../runtime/use-view-runtime";
import type { Handler, Issue } from "../spec/types";
import type { PartialDocument } from "../stream/snapshot";
import { FormsRoot, type FormsSnapshot } from "./FormsRoot";

const COMPLETE: StreamingState = { complete: true, pending: new Set(), fallback: "none" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface ViewProps {
  readonly doc: PartialDocument;
  readonly adapters?: RendererAdapters;
  readonly streaming?: StreamingState;
  readonly onIssue?: (issue: Issue) => void;
  readonly expose?: (runtime: ViewRuntime) => void;
}

/** The contact form as a document would place it: Form, a bound Field, a submit button. */
function ContactForm({ forms }: { forms: FormsSnapshot }): ReactNode {
  const handle = forms.handles.contact;
  return (
    <>
      {handle === undefined ? (
        <p>waiting</p>
      ) : (
        <Form form={handle}>
          <Field name="email">
            <Field.Label>Email</Field.Label>
            <Input type="email" />
            <Field.Error />
          </Field>
          <FormActions>
            <FormActions.Submit>Send</FormActions.Submit>
          </FormActions>
        </Form>
      )}
      <output data-testid="state">{JSON.stringify(forms.values.contact ?? null)}</output>
    </>
  );
}

function View({ doc, adapters = {}, streaming = COMPLETE, onIssue, expose }: ViewProps): ReactNode {
  const runtime = useViewRuntime({ document: doc, streaming, adapters, onIssue });
  expose?.(runtime);
  return (
    <FormsRoot
      defs={doc.forms}
      streaming={streaming}
      roots={runtime.roots}
      dispatch={runtime.dispatch}
      registry={runtime.forms}
      report={runtime.issues.report}
    >
      {(forms) => <ContactForm forms={forms} />}
    </FormsRoot>
  );
}

function formState() {
  return JSON.parse(screen.getByTestId("state").textContent ?? "null") as {
    values: Record<string, unknown>;
    errors: Record<string, string>;
    submitting: boolean;
    submitFailed: boolean;
    dirty: boolean;
  } | null;
}

const SUBMIT: Handler = {
  action: "apiCall",
  payload: { endpoint: "/api/contact", method: "POST", body: { $ref: "event.value" } },
};

function contactDoc(extra: Record<string, unknown> = {}): PartialDocument {
  return {
    version: 2,
    title: "Contact",
    forms: {
      contact: {
        fields: {
          email: { rules: { required: true, pattern: "^[^@\\s]+@[^@\\s]+$" }, messages: { required: "Email, please." } },
          start: { type: "date", initialValue: "2026-11-02" },
        },
        onSubmit: SUBMIT,
        ...extra,
      },
    },
    root: "",
  };
}

describe("FormsRoot", () => {
  it("validates on submit and runs onInvalid, not onSubmit, while invalid", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({})));
    const onInvalid: Handler = { action: "setState", payload: { path: "state.invalid", value: { $ref: "event.value" } } };
    let runtime: ViewRuntime | undefined;
    render(<View doc={contactDoc({ onInvalid })} adapters={{ fetch }} expose={(value) => (runtime = value)} />);

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Email, please.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(0);
    expect(runtime?.roots.state).toEqual({ invalid: { email: "Email, please." } });
    expect(formState()).toMatchObject({ submitFailed: true, errors: { email: "Email, please." } });
  });

  it("submits the values as JSON (dates as ISO days) and is submitting while the apiCall pends", async () => {
    const reply = deferred<Response>();
    const fetch = vi.fn((_url: string, _init: RequestInit) => reply.promise);
    render(<View doc={contactDoc()} adapters={{ fetch }} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@aurora.test");
    expect(formState()).toMatchObject({ values: { email: "ada@aurora.test", start: "2026-11-02" }, dirty: true });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1].body))).toEqual({ email: "ada@aurora.test", start: "2026-11-02" });
    expect(formState()?.submitting).toBe(true);

    await act(async () => reply.resolve(json({ id: 1 })));
    await waitFor(() => expect(formState()?.submitting).toBe(false));
    expect(formState()).toMatchObject({ submitFailed: false });
  });

  it("shows a failed submit's { errors } on their fields", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({ errors: { email: "That address is taken." } }, 422)));
    render(<View doc={contactDoc()} adapters={{ fetch }} />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@aurora.test");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("That address is taken.")).toBeInTheDocument();
    expect(formState()).toMatchObject({ submitFailed: true, submitting: false, errors: { email: "That address is taken." } });
  });

  it("fails the submit on the form itself when the failure names no field", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({ message: "down" }, 503)));
    const issues: Issue[] = [];
    render(<View doc={contactDoc()} adapters={{ fetch }} onIssue={(issue) => issues.push(issue)} />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@aurora.test");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(formState()?.submitFailed).toBe(true));
    expect(formState()?.errors).toEqual({ "": "The request failed with status 503." });
    await waitFor(() => expect(issues.map((issue) => [issue.code, issue.path])).toEqual([["action-failed", "/forms/contact/onSubmit"]]));
  });

  it("mounts once the data its initial values read has loaded, and resetForm reads it again", async () => {
    const replies: Array<ReturnType<typeof deferred<Response>>> = [];
    const fetch = vi.fn(() => {
      const reply = deferred<Response>();
      replies.push(reply);
      return reply.promise;
    });
    const doc: PartialDocument = {
      version: 2,
      title: "Profile",
      data: { profile: { type: "api", endpoint: "/api/profile", query: { v: { $ref: "state.version" } } } },
      forms: { contact: { fields: { email: { initialValue: { $ref: "data.profile.email" } } } } },
      root: "",
    };
    let runtime: ViewRuntime | undefined;
    render(<View doc={doc} adapters={{ fetch }} expose={(value) => (runtime = value)} />);

    expect(screen.getByText("waiting")).toBeInTheDocument();
    await waitFor(() => expect(replies).toHaveLength(1));
    await act(async () => replies[0]?.resolve(json({ email: "first@aurora.test" })));
    expect(screen.getByLabelText("Email")).toHaveValue("first@aurora.test");

    await userEvent.clear(screen.getByLabelText("Email"));
    await userEvent.type(screen.getByLabelText("Email"), "typed@aurora.test");

    // A refetch (back to loading) keeps the mounted form and what the user typed.
    await act(async () => {
      await runtime?.dispatch({ action: "setState", payload: { path: "state.version", value: 2 } }, { args: [], vars: {}, path: "/t" });
    });
    await waitFor(() => expect(replies).toHaveLength(2));
    expect(screen.getByLabelText("Email")).toHaveValue("typed@aurora.test");
    await act(async () => replies[1]?.resolve(json({ email: "second@aurora.test" })));

    await act(async () => {
      await runtime?.dispatch({ action: "resetForm", payload: { form: "contact" } }, { args: [], vars: {}, path: "/t" });
    });
    expect(screen.getByLabelText("Email")).toHaveValue("second@aurora.test");
  });

  it("submitForm from outside the form submits it; an invalid form stops the handler list", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({})));
    let runtime: ViewRuntime | undefined;
    render(<View doc={contactDoc()} adapters={{ fetch }} expose={(value) => (runtime = value)} />);
    const handler: Handler = [
      { action: "submitForm", payload: { form: "contact" } },
      { action: "setState", payload: { path: "state.sent", value: true } },
    ];

    await act(async () => {
      await expect(runtime?.dispatch(handler, { args: [], vars: {}, path: "/t" })).rejects.toThrow("The form did not submit.");
    });
    expect(runtime?.roots.state).toEqual({});

    await userEvent.type(screen.getByLabelText("Email"), "ada@aurora.test");
    await act(async () => {
      await runtime?.dispatch(handler, { args: [], vars: {}, path: "/t" });
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(runtime?.roots.state).toEqual({ sent: true });
  });

  it("waits while the def is still streaming", () => {
    const streaming: StreamingState = { complete: false, pending: new Set(["", "/forms", "/forms/contact"]), fallback: "none" };
    render(<View doc={contactDoc()} streaming={streaming} />);
    expect(screen.getByText("waiting")).toBeInTheDocument();
  });

  it("keeps the store for a re-emitted identical def and starts afresh for a changed one", async () => {
    const { rerender } = render(<View doc={contactDoc()} />);
    await userEvent.type(screen.getByLabelText("Email"), "kept@aurora.test");

    rerender(<View doc={JSON.parse(JSON.stringify(contactDoc())) as PartialDocument} />);
    expect(screen.getByLabelText("Email")).toHaveValue("kept@aurora.test");

    rerender(<View doc={contactDoc({ validateOn: "change" })} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });
});
