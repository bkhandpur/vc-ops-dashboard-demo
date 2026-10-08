"use client";

import { useState } from "react";

import { Button, Callout, Field, Input, TextArea } from "../ui";
import { CompanyTypeahead, type CompanyHit } from "./CompanyTypeahead";
import {
  ActionShell,
  ConfirmSummary,
  SuccessState,
  errorMessage,
  postJson,
  type PaletteActionProps,
} from "./shared";

export function LogNoteOnCompany({ onBack, onClose }: PaletteActionProps) {
  const [company, setCompany] = useState<CompanyHit | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [step, setStep] = useState<"pick" | "compose" | "confirm" | "done">("pick");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!company) return;
    setSubmitting(true);
    setError(null);
    try {
      await postJson("/api/crm/notes/create", {
        recordId: company.recordId,
        title:
          title.trim() || `Note · ${new Date().toLocaleDateString("en-US", { timeZone: "UTC" })}`,
        content: content.trim(),
      });
      setStep("done");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && company) {
    return (
      <ActionShell title="Log a note" onBack={onBack}>
        <SuccessState
          heading={`Note added to ${company.name ?? "company"}`}
          links={[{ label: "Open in the CRM", href: company.crmUrl }]}
          onClose={onClose}
        />
      </ActionShell>
    );
  }

  if (step === "pick") {
    return (
      <ActionShell
        title="Log a note on a company"
        subtitle="Step 1 of 2 — pick the company"
        onBack={onBack}
      >
        <CompanyTypeahead
          onSelect={(hit) => {
            setCompany(hit);
            setStep("compose");
          }}
        />
      </ActionShell>
    );
  }

  if (step === "confirm" && company) {
    return (
      <ActionShell
        title="Confirm before writing to the CRM"
        subtitle="Nothing has been written yet."
        onBack={() => setStep("compose")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStep("compose")} disabled={submitting}>
              Edit
            </Button>
            <Button variant="primary" onClick={submit} disabled={submitting}>
              {submitting ? "Writing…" : "Confirm & create note"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ConfirmSummary
            heading="This will create a note attached to the company record."
            rows={[
              { label: "Company", value: company.name ?? company.recordId },
              {
                label: "Title",
                value:
                  title || `Note · ${new Date().toLocaleDateString("en-US", { timeZone: "UTC" })}`,
              },
              {
                label: "Body",
                value: <span className="whitespace-pre-wrap">{content}</span>,
              },
            ]}
          />
          {error && <Callout tone="error">{error}</Callout>}
        </div>
      </ActionShell>
    );
  }

  return (
    <ActionShell
      title={`Note on ${company?.name ?? "company"}`}
      subtitle="Step 2 of 2: write the note"
      onBack={() => setStep("pick")}
      footer={
        <Button
          variant="primary"
          onClick={() => setStep("confirm")}
          disabled={content.trim().length === 0}
        >
          Review
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Title" hint="Defaults to today's date if left blank.">
          <Input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Note" required>
          <TextArea
            autoFocus
            maxLength={1200}
            className="min-h-40"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What was discussed, next steps, who was on the call…"
          />
        </Field>
      </div>
    </ActionShell>
  );
}
