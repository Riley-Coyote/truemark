/** Shared programs and marketing. All mutations use role-checked database functions. */
export type ProgramSettings = {
  rewards_enabled: boolean;
  memberships_enabled: boolean;
  earn_per_dollar: number;
  points_per_dollar: number;
  min_points: number;
  max_percent: number;
  version: number;
  updated_at: string;
};
export type MembershipTier = {
  id: string;
  name: string;
  threshold: number;
  discount: number;
  note: string;
  active: boolean;
  version: number;
};
export type RewardEntry = {
  id: string;
  buyer_id: string;
  order_id: string | null;
  points: number;
  kind: string;
  note: string;
  created_at: string;
};
export type CustomerWallet = {
  buyerId: string;
  balance: number;
  available: number;
  spend: number;
  tier: MembershipTier | null;
  settings: ProgramSettings;
};
export type Benefits = {
  membershipName: string | null;
  membershipAmount: number;
  rewardAmount: number;
  rewardPoints: number;
  promoAmount: number;
};
export type MarketingContact = {
  id: string;
  name: string;
  email: string;
  status: "subscribed" | "suppressed";
  consent_at: string;
  source: string;
  version: number;
};
export type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  segment: "all" | "buyers";
  status: "draft" | "scheduled" | "completed" | "cancelled";
  scheduled_at: string | null;
  version: number;
};
export type MarketingFlow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  delay_hours: number;
  active: boolean;
  version: number;
};
export type MarketingDelivery = {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  flow_id: string | null;
  order_id: string | null;
  subject: string;
  body: string;
  status: "queued" | "simulated" | "suppressed";
  due_at: string;
  processed_at: string | null;
  reason: string | null;
};
type Rpc = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
type Rows = (
  table: string,
  select?: string,
  filters?: Record<string, string>,
) => Promise<Record<string, unknown>[]>;
export function createPrograms(rows: Rows, rpc: Rpc, changed: () => void) {
  const list = async <T>(table: string, filters?: Record<string, string>) =>
    (await rows(table, "*", filters)) as unknown as T[];
  const save = async <T>(name: string, args: Record<string, unknown>) => {
    const result = await rpc<T>(name, args);
    changed();
    return result;
  };
  return {
    async dashboard() {
      const [settings, tiers, ledger, wallets] = await Promise.all([
        list<ProgramSettings>("customer_program_settings"),
        list<MembershipTier>("membership_tiers"),
        list<RewardEntry>("reward_ledger"),
        rpc<CustomerWallet[]>("team_customer_wallets"),
      ]);
      if (!settings[0]) throw Error("Program settings are unavailable.");
      return {
        settings: settings[0],
        tiers,
        ledger: ledger.sort((a, b) => b.created_at.localeCompare(a.created_at)),
        wallets,
      };
    },
    myWallet: () => rpc<CustomerWallet>("my_customer_programs"),
    myLedger: () => list<RewardEntry>("reward_ledger"),
    benefits: (subtotal: number, promo: number, points = 0) =>
      rpc<Benefits>("my_checkout_benefits", {
        subtotal,
        promo_amount: promo,
        reward_points: points,
      }),
    saveSettings: (draft: ProgramSettings) =>
      save<ProgramSettings>("set_customer_programs", {
        draft,
        expected_version: draft.version,
      }),
    saveTier: (draft: Partial<MembershipTier>) =>
      save<MembershipTier>("save_membership_tier", {
        draft,
        expected_version: draft.version ?? null,
      }),
    adjust: (
      buyerId: string,
      points: number,
      note: string,
      requestId: string,
    ) =>
      save<RewardEntry>("adjust_reward_points", {
        buyer_id: buyerId,
        points,
        note,
        request_id: requestId,
      }),
    async marketing() {
      const [contacts, campaigns, flows, deliveries] = await Promise.all([
        list<MarketingContact>("marketing_contacts"),
        list<Campaign>("marketing_campaigns"),
        list<MarketingFlow>("marketing_flows"),
        list<MarketingDelivery>("marketing_deliveries"),
      ]);
      return { contacts, campaigns, flows, deliveries };
    },
    importContacts: (
      drafts: {
        name: string;
        email: string;
        consent_at: string;
        source: string;
      }[],
    ) => save<number>("import_marketing_contacts", { drafts }),
    suppress: (contact: MarketingContact) =>
      save<void>("suppress_marketing_contact", {
        contact_id: contact.id,
        expected_version: contact.version,
      }),
    saveCampaign: (draft: Partial<Campaign>) =>
      save<Campaign>("save_marketing_campaign", {
        draft,
        expected_version: draft.version ?? null,
      }),
    schedule: (campaign: Campaign, at: string) =>
      save<number>("schedule_marketing_campaign", {
        campaign_id: campaign.id,
        scheduled_at: at,
        expected_version: campaign.version,
      }),
    cancel: (campaign: Campaign) =>
      save<void>("cancel_marketing_campaign", {
        campaign_id: campaign.id,
        expected_version: campaign.version,
      }),
    saveFlow: (draft: MarketingFlow) =>
      save<MarketingFlow>("save_marketing_flow", {
        draft,
        expected_version: draft.version,
      }),
    runQueue: () =>
      save<{ processed: number; transport: string }>(
        "run_marketing_test_queue",
        {},
      ),
    consent: () =>
      rpc<{
        subscribed: boolean;
        consentAt: string | null;
        source: string | null;
      }>("my_marketing_consent"),
    setConsent: (subscribed: boolean) =>
      save<void>("set_my_marketing_consent", { subscribed }),
  };
}
