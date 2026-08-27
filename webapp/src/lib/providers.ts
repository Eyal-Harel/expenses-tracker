// The fixed set of providers this app actually knows how to parse. Drives
// both the "what do you bank with" picker (welcome/settings) and which
// upload slots show up on /upload — a provider not in one of these lists
// has no parser behind it yet, so it isn't offered as a choice at all.
export const SUPPORTED_BANKS = ["Bank Leumi"] as const;
export type SupportedBank = (typeof SUPPORTED_BANKS)[number];

export const SUPPORTED_CARD_COMPANIES = ["Cal", "Max", "IsraCard"] as const;
export type SupportedCardCompany = (typeof SUPPORTED_CARD_COMPANIES)[number];

export function isSupportedBank(value: string): value is SupportedBank {
  return (SUPPORTED_BANKS as readonly string[]).includes(value);
}

export function isSupportedCardCompany(value: string): value is SupportedCardCompany {
  return (SUPPORTED_CARD_COMPANIES as readonly string[]).includes(value);
}
