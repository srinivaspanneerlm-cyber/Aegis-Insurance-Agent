"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@aegis/ui";
import { Field, Select, TextArea } from "@/components/forms/Field";
import { Icon } from "@/components/ui/Icon";
import {
  ORGANIZATION_SIZES,
  hasErrors,
  validateEnquiry,
  type EnquiryInput,
  type FieldErrors,
} from "@/lib/enquiry";

export interface EnquiryFormProps {
  kind: EnquiryInput["kind"];
  submitLabel: string;
  /** Shown after a successful send. */
  successTitle: string;
  successBody: string;
}

/**
 * One form for both the contact page and the demo request.
 *
 * They differ only in which fields are required, and that difference already
 * lives in `validateEnquiry` — which the server uses too. Two components would
 * have meant two places for the demo form to drift out of step with the rule
 * that actually decides whether a submission is accepted.
 */
export function EnquiryForm({ kind, submitLabel, successTitle, successBody }: EnquiryFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [failure, setFailure] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  const isDemo = kind === "demo";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: EnquiryInput = {
      kind,
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      company: String(data.get("company") ?? ""),
      organizationSize: String(data.get("organizationSize") ?? ""),
      message: String(data.get("message") ?? ""),
      website: String(data.get("website") ?? ""),
    };

    const found = validateEnquiry(payload);
    setErrors(found);
    if (hasErrors(found)) {
      // Send focus to the first problem. Without this a keyboard or
      // screen-reader user is left at the submit button being told, somewhere
      // above them, that something is wrong.
      const firstField = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      return;
    }

    setStatus("sending");
    setFailure("");
    try {
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 422 && body.errors) {
          setErrors(body.errors as FieldErrors);
          setStatus("idle");
          return;
        }
        throw new Error(body.message ?? "We could not send that just now.");
      }

      setStatus("sent");
      formRef.current?.reset();
    } catch (error) {
      setStatus("failed");
      setFailure(error instanceof Error ? error.message : "We could not send that just now.");
    }
  }

  if (status === "sent") {
    return (
      <div
        // Focusable so the confirmation can be moved to; announced because the
        // form it replaced has just disappeared from under the cursor.
        tabIndex={-1}
        role="status"
        className="flex flex-col items-start gap-4 rounded-panel p-8 glass glass-sheen"
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-control bg-success/15 text-success">
          <Icon name="check" size={24} />
        </span>
        <h2 className="text-h3 font-semibold text-content">{successTitle}</h2>
        <p className="text-pretty text-body text-content-secondary">{successBody}</p>
        <Button variant="secondary" size="md" onClick={() => setStatus("idle")}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-panel p-6 glass glass-sheen sm:p-8"
    >
      {/* Honeypot. Hidden from sight and from assistive technology, and never
          auto-filled — so anything in it came from a bot filling every input. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website-hp">Leave this field empty</label>
        <input id="website-hp" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {isDemo ? (
        <Field
          label="Company name"
          name="company"
          required
          autoComplete="organization"
          placeholder="Acme Insurance Ltd"
          error={errors.company}
        />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Your name"
          name="name"
          required
          autoComplete="name"
          placeholder="Priya Raman"
          error={errors.name}
        />
        <Field
          label={isDemo ? "Business email" : "Email address"}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={isDemo ? "priya@company.com" : "priya@example.com"}
          hint={isDemo ? "A work address helps us prepare the right demo." : undefined}
          error={errors.email}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Phone"
          name="phone"
          type="tel"
          required={isDemo}
          autoComplete="tel"
          placeholder="+91 98400 00000"
          error={errors.phone}
        />
        {isDemo ? (
          <Select
            label="Organisation size"
            name="organizationSize"
            required
            options={ORGANIZATION_SIZES}
            placeholder="Choose a size"
            error={errors.organizationSize}
          />
        ) : (
          <Field
            label="Company"
            name="company"
            autoComplete="organization"
            placeholder="If you are enquiring for an organisation"
            error={errors.company}
          />
        )}
      </div>

      <TextArea
        label={isDemo ? "What would you like to see?" : "How can we help?"}
        name="message"
        required
        rows={5}
        placeholder={
          isDemo
            ? "Tell us about your portfolio, the workflows you want to improve, and anyone who should join the call."
            : "Tell us what you are trying to work out, and we will point you to the right place."
        }
        error={errors.message}
      />

      {status === "failed" ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {failure} You can also email us directly — the address is at the foot of this page.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={status === "sending"}>
          {submitLabel}
        </Button>
        <p className="text-pretty text-caption text-content-muted">
          We use what you send here only to reply to you.
        </p>
      </div>
    </form>
  );
}
