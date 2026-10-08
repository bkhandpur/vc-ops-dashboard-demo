"use client";

import { useState } from "react";

import { Button, Callout, Field, Input, TextArea } from "../ui";
import {
  ActionShell,
  ConfirmSummary,
  SuccessState,
  errorMessage,
  postJson,
  type PaletteActionProps,
} from "./shared";

interface SubmitResult {
  person: { recordId: string; name: string | null; crmUrl: string };
  addedToList: boolean;
}

export function AddStealthFounder({ onBack, onClose }: PaletteActionProps) {
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const canContinue = name.trim().length > 0 && /.+@.+\..+/.test(email.trim());

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await postJson<SubmitResult>("/api/crm/people/add-stealth-founder", {
        name: name.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
      });
      setResult(payload);
      setStep("done");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && result) {
    return (
      <ActionShell title="Add Stealth Founder" onBack={onBack}>
        <SuccessState
          heading={`${result.person.name ?? "Person"} added to Stealth Founders`}
          links={[{ label: "Open in the CRM", href: result.person.crmUrl }]}
          onClose={onClose}
        />
      </ActionShell>
    );
  }

  if (step === "confirm") {
    return (
      <ActionShell
        title="Confirm before writing to the CRM"
        subtitle="Nothing has been written yet."
        onBack={() => setStep("form")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStep("form")} disabled={submitting}>
              Edit
            </Button>
            <Button variant="primary" onClick={submit} disabled={submitting}>
              {submitting ? "Writing…" : "Confirm & add"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ConfirmSummary
            heading="This will upsert a person record and add them to Stealth Founders."
            rows={[
              { label: "Name", value: name },
              { label: "Email", value: email },
              { label: "Context notes", value: notes },
            ]}
            note="An existing sample person with this email is updated. Otherwise, a new sample record is created."
          />
          {error && <Callout tone="error">{error}</Callout>}
        </div>
      </ActionShell>
    );
  }

  return (
    <ActionShell
      title="Add Stealth Founder"
      subtitle="Upsert on people, then add to Stealth Founders"
      onBack={onBack}
      footer={
        <Button variant="primary" onClick={() => setStep("confirm")} disabled={!canContinue}>
          Review
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Full name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" required hint="Used as the upsert matching key.">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </Field>
        <Field label="Company / context notes" hint="Written to the person's description field.">
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex-Stripe, building in payments infra. Intro via …"
          />
        </Field>
      </div>
    </ActionShell>
  );
}
