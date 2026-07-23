export interface LoyaltyRule {
  minimumAmount: number;
  units: number;
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
