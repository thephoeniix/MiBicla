export interface LoyaltyRule {
  minimumAmount: number;
  units: number;
}

export interface EditableLoyaltySettings {
  enabled: boolean;
  currency: "MXN";
  purchaseRules: LoyaltyRule[];
  rewardUnits: number;
  rewardDiscountPercent: number;
  rewardName: string;
  rewardDescription: string;
  allowManualAdjustments: boolean;
  allowNegativeBalance: boolean;
}

export function editableLoyaltySettings(
  input: Omit<EditableLoyaltySettings, "rewardDiscountPercent"> & {
    rewardDiscountPercent: number | string;
  } & Record<string, unknown>,
): EditableLoyaltySettings {
  return {
    enabled: input.enabled,
    currency: input.currency,
    purchaseRules: input.purchaseRules,
    rewardUnits: input.rewardUnits,
    rewardDiscountPercent: Number(input.rewardDiscountPercent),
    rewardName: input.rewardName,
    rewardDescription: input.rewardDescription,
    allowManualAdjustments: input.allowManualAdjustments,
    allowNegativeBalance: input.allowNegativeBalance,
  };
}

export function moveLoyaltyStage(current: number, direction: -1 | 1) {
  return Math.min(4, Math.max(1, current + direction));
}

export function replaceLoyaltyRule(
  rules: LoyaltyRule[],
  index: number,
  patch: Partial<LoyaltyRule>,
) {
  return rules.map((rule, current) =>
    current === index ? { ...rule, ...patch } : rule,
  );
}

export function loyaltySettingsChanged(current: unknown, original: unknown) {
  return JSON.stringify(current) !== JSON.stringify(original);
}
