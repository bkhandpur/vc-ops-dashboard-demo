"use client";

import { CompanyTypeahead } from "./CompanyTypeahead";
import { ActionShell, type PaletteActionProps } from "./shared";

/** Read-only action — opens the CRM record in a new tab. No confirm step needed. */
export function JumpToCompany({ onBack, onClose }: PaletteActionProps) {
  return (
    <ActionShell
      title="Jump to company in the CRM"
      subtitle="Opens the record in a new tab"
      onBack={onBack}
    >
      <CompanyTypeahead
        onSelect={(hit) => {
          window.open(hit.crmUrl, "_blank", "noopener,noreferrer");
          onClose();
        }}
      />
    </ActionShell>
  );
}
