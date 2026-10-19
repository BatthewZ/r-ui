"use client";

import { type ComponentPropsWithRef, type ReactNode, useEffect, useRef, useState } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { ToneGlyph } from "../../util/tone";
import { Checkbox, Field, Form, Input, useForm } from "../form";
import { Button } from "../primitives";

/** Every string EmailCapture says, for localisation. */
export interface EmailCaptureLabels {
  /** The email field's label (visually hidden with `hideLabel`, still its name). */
  email: string;
  placeholder: string;
  submit: string;
  /** The field's error when it is empty on submit. */
  required: string;
  /** The field's error when the address is not one. */
  invalid: string;
  /** The consent box's error when it must be ticked and is not. */
  consentRequired: string;
  /** The field's error when `onSubmit` rejects; the press after it retries. */
  failed: (error: unknown) => string;
  successTitle: string;
  successMessage: (email: string) => string;
  /** The honeypot field's label (hidden from people and assistive tech). */
  honeypot: string;
}

export const DEFAULT_EMAIL_CAPTURE_LABELS: EmailCaptureLabels = {
  email: "Email address",
  placeholder: "you@example.com",
  submit: "Subscribe",
  required: "Enter your email address.",
  invalid: "Enter an email address like name@example.com.",
  consentRequired: "Tick the box to agree before subscribing.",
  failed: () => "We could not subscribe you just now. Try again.",
  successTitle: "You are subscribed",
  successMessage: (email) => `We sent a confirmation to ${email}.`,
  honeypot: "Leave this field empty",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    EmailCapture: EmailCaptureLabels;
  }
}

export interface EmailCaptureSubmitDetails {
  /** Whether the consent box was ticked (`false` when there is none). */
  consent: boolean;
}

export type EmailCaptureProps = {
  /**
   * Called with the trimmed address once it is valid. Pending while the promise
   * runs; a rejection shows `labels.failed` as the field's error and keeps the
   * form, so the next press retries; resolving replaces the form with the
   * success message.
   */
  onSubmit: (email: string, details: EmailCaptureSubmitDetails) => Promise<void> | void;
  /** The consent checkbox's label. Without it there is no checkbox. */
  consent?: ReactNode;
  /** Whether the consent box must be ticked to submit (default `true`). */
  consentRequired?: boolean;
  /**
   * Adds a honeypot: a field people never see or reach (`true` names it
   * `website`; a string names it). When it is filled the form shows success
   * without calling `onSubmit`.
   */
  honeypot?: boolean | string;
  /** A note under the field (what you will send, how often, a privacy link). */
  description?: ReactNode;
  /** Hides the field's label visually; it still names the field. Give the context another way (a heading). */
  hideLabel?: boolean;
  defaultValue?: string;
  disabled?: boolean;
  labels?: LabelsProp<EmailCaptureLabels>;
  classNames?: SlotClassNames<"form" | "row" | "input" | "submit" | "consent" | "success">;
} & Omit<ComponentPropsWithRef<"div">, "onSubmit" | "children" | "defaultValue">;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Values {
  email: string;
  consent: boolean;
}

/**
 * A newsletter or lead form: an email field and a submit button on one row
 * when the form's OWN width allows (a 28rem container), stacked below that;
 * optionally a consent box and a honeypot. Built on `Form`, `Field`, `Input`,
 * `Checkbox` and `Button`.
 *
 * States: invalid (the Field's error, focus on the field), pending (the button
 * busy, further presses ignored), failed (the rejection's message as the
 * field's error, focus on the field; the next press retries) and success (the
 * form is replaced by a message, which takes focus and is announced as a
 * status).
 */
export function EmailCapture({
  onSubmit,
  consent,
  consentRequired = true,
  honeypot,
  description,
  hideLabel = false,
  defaultValue = "",
  disabled = false,
  labels: labelsProp,
  className,
  classNames,
  ...props
}: EmailCaptureProps) {
  const labels = useLabels("EmailCapture", DEFAULT_EMAIL_CAPTURE_LABELS, labelsProp);
  const [subscribed, setSubscribed] = useState<string | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ onSubmit, labels, consentRequired });
  latest.current = { onSubmit, labels, consentRequired };

  const form = useForm<Values>({
    defaultValues: { email: defaultValue, consent: false },
    // Nothing is flagged while the first address is typed; once shown, an error clears as it is fixed.
    validateOn: "submit",
    onSubmit: async ({ email, consent: agreed }, helpers) => {
      const address = email.trim();
      if (honeypotRef.current?.value) {
        setSubscribed(address);
        return;
      }
      try {
        await latest.current.onSubmit(address, { consent: agreed });
        setSubscribed(address);
      } catch (error) {
        // A field error fails the submit, so the Form moves focus to the field, described by it.
        helpers.setErrors({ email: latest.current.labels.failed(error) });
      }
    },
  });

  useEffect(() => {
    if (subscribed !== null) statusRef.current?.focus();
  }, [subscribed]);

  const honeypotName = honeypot === true ? "website" : honeypot || undefined;
  const succeeded = subscribed !== null;

  return (
    <div className={cn("@container min-w-0", className)} {...props}>
      {/* Mounted from the start, so the message is announced as it arrives. */}
      <div
        ref={statusRef}
        role="status"
        tabIndex={succeeded ? -1 : undefined}
        className={cn(succeeded && "flex items-start gap-r4 rounded-lg border border-status-success/30 bg-status-success-bg p-r3", classNames?.success)}
      >
        {succeeded && (
          <>
            <span className="flex h-(--BodyText-1-line-height) shrink-0 items-center">
              <ToneGlyph tone="success" className="size-icon text-status-success" />
            </span>
            <div className="grid min-w-0 gap-r6">
              <p className="break-words text-body-1 font-semibold text-fg-primary">{labels.successTitle}</p>
              <p className="[overflow-wrap:anywhere] text-body-2 text-fg-primary">{labels.successMessage(subscribed)}</p>
            </div>
          </>
        )}
      </div>
      {!succeeded && (
        <Form
          form={form}
          // A failed attempt's message would otherwise block the retry until the address changes.
          onSubmitCapture={() => form.setErrors({ email: null })}
          className={cn("grid min-w-0 gap-r3", classNames?.form)}
        >
          <Field
            name="email"
            required
            disabled={disabled}
            validate={(value) => {
              const text = typeof value === "string" ? value.trim() : "";
              if (!text) return latest.current.labels.required;
              return EMAIL.test(text) ? undefined : latest.current.labels.invalid;
            }}
          >
            <Field.Label className={cn(hideLabel && "sr-only")}>{labels.email}</Field.Label>
            <div className={cn("grid min-w-0 gap-r4 @md:grid-cols-[minmax(0,1fr)_auto]", classNames?.row)}>
              <Input
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={labels.placeholder}
                className={classNames?.input}
              />
              <Button
                type="submit"
                data-print="hide"
                loading={form.state.submitting}
                disabled={disabled}
                className={classNames?.submit}
              >
                {labels.submit}
              </Button>
            </div>
            {description != null && <Field.Description>{description}</Field.Description>}
            <Field.Error />
          </Field>
          {consent != null && (
            <Field
              name="consent"
              required={consentRequired}
              disabled={disabled}
              validate={(value) => (latest.current.consentRequired && value !== true ? latest.current.labels.consentRequired : undefined)}
              className={classNames?.consent}
            >
              <Checkbox>{consent}</Checkbox>
              <Field.Error />
            </Field>
          )}
          {honeypotName && (
            <div aria-hidden className="sr-only">
              <label>
                {labels.honeypot}
                <input ref={honeypotRef} type="text" name={honeypotName} tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>
          )}
        </Form>
      )}
    </div>
  );
}
