import { eq, sql } from "drizzle-orm";
import {
  customerLoyaltyBalance,
  customerLoyaltyMovements,
  customerRewards,
  loyaltySettings,
  type createDatabase,
  type PurchaseRule,
} from "@mi-bicla/db";
import type { LoyaltySettingsInput } from "@mi-bicla/api-contract";
type Db = ReturnType<typeof createDatabase>["db"];
export function calculateLoyaltyUnits(
  amountCents: number,
  rules: PurchaseRule[],
): number {
  if (!Number.isInteger(amountCents) || amountCents < 0)
    throw new Error("Monto inválido");
  return [...rules]
    .sort((a, b) => a.minimumAmount - b.minimumAmount)
    .reduce(
      (units, rule) => (amountCents >= rule.minimumAmount ? rule.units : units),
      0,
    );
}
export function convertUnitsToRewards(
  availableUnits: number,
  rewardUnits: number,
) {
  if (!Number.isInteger(rewardUnits) || rewardUnits <= 0)
    throw new Error("Configuración de recompensa inválida");
  return {
    remainingUnits: availableUnits % rewardUnits,
    rewardsCreated: Math.floor(availableUnits / rewardUnits),
  };
}
const DEFAULT: LoyaltySettingsInput = {
  enabled: false,
  currency: "MXN",
  purchaseRules: [],
  rewardUnits: 10,
  rewardDiscountPercent: 10,
  rewardName: "Recompensa",
  rewardDescription: "",
  allowManualAdjustments: false,
  allowNegativeBalance: false,
};
export class LoyaltyService {
  constructor(private db: Db) {}
  async get() {
    return (await this.db.select().from(loyaltySettings).limit(1))[0] ?? null;
  }
  async save(input: LoyaltySettingsInput, administratorId: string) {
    const current = await this.get(),
      values = {
        ...input,
        rewardDiscountPercent: String(input.rewardDiscountPercent),
        updatedAt: new Date(),
        updatedBy: administratorId,
      };
    if (current) {
      const [row] = await this.db
        .update(loyaltySettings)
        .set(values)
        .where(eq(loyaltySettings.id, current.id))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(loyaltySettings)
      .values(values)
      .returning();
    return row;
  }
  async adjust(customerId: string, units: number, administratorId: string, reason: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtext(${customerId}), hashtext('loyalty-adjustment'))
      `);
      const settings =
        (await tx.select().from(loyaltySettings).limit(1))[0] ?? null;
      if (!settings?.allowManualAdjustments)
        throw new Error("Los ajustes manuales no están habilitados");
      const current = (
        await tx
          .select()
          .from(customerLoyaltyBalance)
          .where(eq(customerLoyaltyBalance.customerId, customerId))
          .limit(1)
      )[0] ?? { availableUnits: 0, pendingUnits: 0, lifetimeUnits: 0 };
      let available = current.availableUnits + units;
      if (!settings.allowNegativeBalance && available < 0)
        throw new Error("Saldo insuficiente");
      const lifetime = current.lifetimeUnits + Math.max(0, units),
        conversion =
          available >= 0
            ? convertUnitsToRewards(available, settings.rewardUnits)
            : { remainingUnits: available, rewardsCreated: 0 };
      available = conversion.remainingUnits;
      const rewards = conversion.rewardsCreated;
      await tx
        .insert(customerLoyaltyBalance)
        .values({
          customerId,
          availableUnits: available,
          pendingUnits: current.pendingUnits,
          lifetimeUnits: lifetime,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: customerLoyaltyBalance.customerId,
          set: {
            availableUnits: available,
            lifetimeUnits: lifetime,
            updatedAt: new Date(),
          },
        });
      for (let i = 0; i < rewards; i++)
        await tx.insert(customerRewards).values({
          customerId,
          rewardName: settings.rewardName,
          rewardDiscountPercent: settings.rewardDiscountPercent,
          requiredUnits: settings.rewardUnits,
          status: "available",
        });
      await tx.insert(customerLoyaltyMovements).values({
        customerId,
        units,
        balanceAfter: available,
        reason,
        createdBy: administratorId,
      });
      return {
        availableUnits: available,
        rewardsCreated: rewards,
        administratorId,
      };
    });
  }
  async settingsOrDefault() {
    return (await this.get()) ?? DEFAULT;
  }
}
