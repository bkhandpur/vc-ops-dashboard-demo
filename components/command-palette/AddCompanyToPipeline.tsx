"use client";

import { useEffect, useState } from "react";

import { Button, Callout, Field, Input, MultiSelect, Select, Spinner, TextArea } from "../ui";
import {
  ActionShell,
  ConfirmSummary,
  SuccessState,
  errorMessage,
  postJson,
  type PaletteActionProps,
} from "./shared";

interface TaxonomyOptions {
  themes: string[];
  canonicalSectors: string[];
  subSectors: string[];
  rounds: string[];
}

interface FormState {
  name: string;
  domain: string;
  description: string;
  theme: string;
  canonicalSector: string;
  subSectors: string[];
  rounds: string[];
}

const EMPTY: FormState = {
  name: "",
  domain: "",
  description: "",
  theme: "",
  canonicalSector: "",
  subSectors: [],
  rounds: [],
};

interface SubmitResult {
  company: { recordId: string; name: string | null; crmUrl: string };
  created: boolean;
  addedToList: boolean;
}

export function AddCompanyToPipeline({ onBack, onClose }: PaletteActionProps) {
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [options, setOptions] = useState<TaxonomyOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Select options are fetched live — they change in the CRM and must not be hardcoded.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/crm/taxonomy");
        const payload = (await res.json()) as TaxonomyOptions & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(payload.error || "Could not load field options");
        setOptions(payload);
      } catch (err) {
        if (!cancelled) setOptionsError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canContinue = form.name.trim().length > 0 && form.domain.trim().length > 0;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await postJson<SubmitResult>("/api/crm/pipeline/add-company", {
        name: form.name.trim(),
        domain: form.domain.trim(),
        description: form.description.trim() || undefined,
        theme: form.theme || undefined,
        canonicalSector: form.canonicalSector || undefined,
        subSectors: form.subSectors,
        rounds: form.rounds,
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
      <ActionShell title="Add company to Pipeline" onBack={onBack}>
        <SuccessState
          heading={`${result.company.name ?? "Company"} is on Pipeline`}
          detail={
            result.created
              ? "New company record created in the CRM."
              : "Matched an existing company by domain and updated it."
          }
          links={[{ label: "Open in the CRM", href: result.company.crmUrl }]}
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
              {submitting ? "Writing…" : "Confirm & add to Pipeline"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ConfirmSummary
            heading="This will upsert a company record and add it to Pipeline."
            rows={[
              { label: "Name", value: form.name },
              { label: "Domain", value: form.domain },
              { label: "Description", value: form.description },
              { label: "Theme", value: form.theme },
              { label: "Canonical Sector", value: form.canonicalSector },
              { label: "Sub-Sector", value: form.subSectors.join(", ") },
              { label: "Investment Round", value: form.rounds.join(", ") },
            ]}
            note="Upsert matches on domain: if a company with this domain already exists, its fields are updated rather than a duplicate being created."
          />
          {error && <Callout tone="error">{error}</Callout>}
        </div>
      </ActionShell>
    );
  }

  return (
    <ActionShell
      title="Add company to Pipeline"
      subtitle="Upsert on companies, then add to Pipeline"
      onBack={onBack}
      footer={
        <Button variant="primary" onClick={() => setStep("confirm")} disabled={!canContinue}>
          Review
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Company name" required>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Acme Health"
          />
        </Field>
        <Field label="Domain" required hint="Used as the upsert matching key.">
          <Input
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            placeholder="acmehealth.com"
          />
        </Field>
        <Field label="Description">
          <TextArea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="One-liner on what they do."
          />
        </Field>

        {optionsError && (
          <Callout tone="warn">
            Could not load the CRM field options ({optionsError}). You can still create the
            company; classification can be set in the CRM afterwards.
          </Callout>
        )}
        {!options && !optionsError && <Spinner label="Loading field options from the CRM…" />}

        {options && (
          <>
            <Field label="Theme" hint="Normally assigned upstream by the rules-based classifier — set only to override.">
              <Select value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                <option value="">(leave unset)</option>
                {options.themes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Canonical Sector">
              <Select
                value={form.canonicalSector}
                onChange={(e) => set("canonicalSector", e.target.value)}
              >
                <option value="">(leave unset)</option>
                {options.canonicalSectors.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sub-Sector" hint="Multiselect (API slug: sub_sector).">
              <MultiSelect
                options={options.subSectors}
                selected={form.subSectors}
                onChange={(next) => set("subSectors", next)}
              />
            </Field>
            <Field label="Investment Round">
              <MultiSelect
                options={options.rounds}
                selected={form.rounds}
                onChange={(next) => set("rounds", next)}
              />
            </Field>
          </>
        )}
      </div>
    </ActionShell>
  );
}
