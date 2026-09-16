/**
 * ── COMMAND PALETTE ACTION REGISTRY ──────────────────────────────────────────
 * Add an action by appending to PALETTE_ACTIONS. Write your step UI as a component
 * taking PaletteActionProps ({ onBack, onClose }) and render it from `render`.
 *
 * Rule for anything that writes to the CRM: the component MUST show a ConfirmSummary
 * step before the API call. No silent writes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import {
  Building2,
  ExternalLink,
  FileText,
  PenLine,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { AddCompanyToPipeline } from "./AddCompanyToPipeline";
import { AddStealthFounder } from "./AddStealthFounder";
import { JumpToCompany } from "./JumpToCompany";
import { LogNoteOnCompany } from "./LogNoteOnCompany";
import { QuickSummary } from "./QuickSummary";
import type { PaletteActionProps } from "./shared";

export interface PaletteAction {
  id: string;
  label: string;
  description: string;
  /** Extra terms the fuzzy matcher should consider. */
  keywords: string[];
  icon: LucideIcon;
  /** True if the action writes to the CRM — shown as a badge in the list. */
  writes: boolean;
  render: (props: PaletteActionProps) => ReactNode;
}

export const PALETTE_ACTIONS: PaletteAction[] = [
  {
    /**
     * Read-only, and first in the list because it is the one people reach for most —
     * the other four are occasional data entry, this is call prep. It correctly has no
     * confirm step: the confirm pattern gates writes, and attaching one to a read would
     * blunt what it signals on the three actions that do mutate the CRM.
     */
    id: "quick-summary",
    label: "Quick summary",
    description: "Call prep for a company — classification, prose, funding, who to bring in",
    keywords: ["summary", "brief", "prep", "call", "meeting", "overview", "tear"],
    icon: FileText,
    writes: false,
    render: (props) => <QuickSummary {...props} />,
  },
  {
    id: "add-company-to-pipeline",
    label: "Add company to Pipeline",
    description: "Upsert a company, then add it to Pipeline",
    keywords: ["new", "company", "pipeline", "deal", "create"],
    icon: Building2,
    writes: true,
    render: (props) => <AddCompanyToPipeline {...props} />,
  },
  {
    id: "add-stealth-founder",
    label: "Add Stealth Founder",
    description: "Upsert a person, then add them to Stealth Founders",
    keywords: ["founder", "stealth", "person", "people", "new"],
    icon: UserPlus,
    writes: true,
    render: (props) => <AddStealthFounder {...props} />,
  },
  {
    id: "log-note",
    label: "Log a note on a company",
    description: "Search a company, then attach a note to its record",
    keywords: ["note", "interaction", "call", "meeting", "log"],
    icon: PenLine,
    writes: true,
    render: (props) => <LogNoteOnCompany {...props} />,
  },
  {
    id: "jump-to-company",
    label: "Jump to company in the CRM",
    description: "Open a company record in the CRM in a new tab",
    keywords: ["open", "crm", "goto", "record", "link"],
    icon: ExternalLink,
    writes: false,
    render: (props) => <JumpToCompany {...props} />,
  },
];
