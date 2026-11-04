import type { PaymentAdapter } from "./types";
import { testAdapter } from "./test-adapter";
import { ccbillAdapter } from "./ccbill-adapter";

/** Katalog: nur echte Implementierungen sind aktivierbar. Status wahrheitsgemäß. */
export interface CatalogEntry {
  key: string;
  displayName: string;
  implStatus: "implemented" | "not_implemented" | "sandbox_only";
  eligibility: "approval_required" | "eligible" | "not_eligible";
  capabilities: string[];
  methods: string[];
  notes: string;
  adapter?: PaymentAdapter;
}

export const PROVIDER_CATALOG: CatalogEntry[] = [
  {
    key: "test", displayName: testAdapter.displayName, implStatus: "sandbox_only", eligibility: "eligible",
    capabilities: testAdapter.capabilities, methods: ["simulation"], notes: testAdapter.notes, adapter: testAdapter,
  },
  {
    key: "ccbill", displayName: "CCBill", implStatus: "sandbox_only", eligibility: "approval_required",
    capabilities: ccbillAdapter.capabilities, methods: ["card", "sepa_debit (laut Vertrag)"], notes: ccbillAdapter.notes, adapter: ccbillAdapter,
  },
  {
    key: "segpay", displayName: "Segpay", implStatus: "not_implemented", eligibility: "approval_required", capabilities: [], methods: [],
    notes: "Kandidat für Adult/Dating laut öffentlicher Ausrichtung. Adapter noch nicht implementiert; Merchant-Onboarding erforderlich.",
  },
  {
    key: "stripe", displayName: "Stripe", implStatus: "not_implemented", eligibility: "not_eligible", capabilities: [], methods: [],
    notes: "Laut Stripe-Richtlinie zu eingeschränkten Geschäftsmodellen voraussichtlich nicht nutzbar; nur nach ausdrücklicher schriftlicher Freigabe neu bewerten.",
  },
  {
    key: "paypal", displayName: "PayPal", implStatus: "not_implemented", eligibility: "not_eligible", capabilities: [], methods: [],
    notes: "Richtlinie zu sexuell orientierten Waren/Dienstleistungen einschränkend; regional vertraglich prüfen.",
  },
  {
    key: "mollie", displayName: "Mollie", implStatus: "not_implemented", eligibility: "approval_required", capabilities: [], methods: [],
    notes: "Eignung für Dating-/Adult-Community vertraglich klären.",
  },
  {
    key: "adyen", displayName: "Adyen", implStatus: "not_implemented", eligibility: "approval_required", capabilities: [], methods: [],
    notes: "Eignung und Risikokategorie vertraglich klären.",
  },
];

export function adapterFor(key: string): PaymentAdapter | undefined {
  return PROVIDER_CATALOG.find((p) => p.key === key)?.adapter;
}

/** Aktivierbar nur, wenn implementiert (oder Sandbox in Nicht-Produktion), konfiguriert und freigegeben. */
export function canEnable(entry: CatalogEntry, mode: "sandbox" | "live"): { ok: boolean; reason?: string } {
  if (!entry.adapter || entry.implStatus === "not_implemented") return { ok: false, reason: "Adapter ist nicht implementiert." };
  if (entry.eligibility === "not_eligible") return { ok: false, reason: "Anbieter ist für das Portal nicht geeignet." };
  if (!entry.adapter.isConfigured()) return { ok: false, reason: "Zugangsdaten/Webhook fehlen." };
  if (mode === "live" && entry.implStatus !== "implemented") return { ok: false, reason: "Nur Sandbox-Stand – Livebetrieb nicht freigegeben." };
  if (mode === "live" && entry.eligibility !== "eligible") return { ok: false, reason: "Vertragliche Freigabe fehlt." };
  return { ok: true };
}
