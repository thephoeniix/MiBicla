import { asc, eq } from "drizzle-orm";
import {
  businessSettings,
  paymentDepositSettings,
  type createDatabase,
} from "@mi-bicla/db";
import { decrypt, encrypt } from "@mi-bicla/shared";
import type {
  BusinessSettingsInput,
  DepositSettingsInput,
} from "@mi-bicla/api-contract";
type Db = ReturnType<typeof createDatabase>["db"];
const EMPTY = {
  businessName: "",
  address: "",
  phone: "",
  email: "",
  primaryWhatsapp: "",
  secondaryWhatsapp: null,
  facebook: null,
  instagram: null,
  tiktok: null,
  website: null,
  openingHours: {},
  logoUrl: null,
  faviconUrl: null,
  themeColor: "#ec3d92",
};
export class BusinessSettingsService {
  constructor(private db: Db) {}
  async getBusiness() {
    return (await this.db.select().from(businessSettings).limit(1))[0] ?? null;
  }
  async saveBusiness(input: BusinessSettingsInput, administratorId: string) {
    const current = await this.getBusiness(),
      now = new Date();
    if (current) {
      const [saved] = await this.db
        .update(businessSettings)
        .set({ ...input, updatedAt: now, updatedBy: administratorId })
        .where(eq(businessSettings.id, current.id))
        .returning();
      if (!saved) throw new Error("No se pudo guardar la configuración");
      return saved;
    }
    const initial: typeof businessSettings.$inferInsert = {
      businessName: input.businessName ?? EMPTY.businessName,
      address: input.address ?? EMPTY.address,
      phone: input.phone ?? EMPTY.phone,
      email: input.email ?? EMPTY.email,
      primaryWhatsapp: input.primaryWhatsapp ?? EMPTY.primaryWhatsapp,
      secondaryWhatsapp: input.secondaryWhatsapp ?? EMPTY.secondaryWhatsapp,
      facebook: input.facebook ?? EMPTY.facebook,
      instagram: input.instagram ?? EMPTY.instagram,
      tiktok: input.tiktok ?? EMPTY.tiktok,
      website: input.website ?? EMPTY.website,
      openingHours: input.openingHours ?? EMPTY.openingHours,
      logoUrl: input.logoUrl ?? EMPTY.logoUrl,
      faviconUrl: input.faviconUrl ?? EMPTY.faviconUrl,
      themeColor: input.themeColor ?? EMPTY.themeColor,
      updatedBy: administratorId,
    };
    const [saved] = await this.db
      .insert(businessSettings)
      .values(initial)
      .returning();
    if (!saved) throw new Error("No se pudo crear la configuración");
    return saved;
  }
  async listDepositsAdmin() {
    const rows = await this.db
      .select()
      .from(paymentDepositSettings)
      .orderBy(
        asc(paymentDepositSettings.sortOrder),
        asc(paymentDepositSettings.createdAt),
      );
    return rows.map(toAdminDeposit);
  }
  async getDepositAdmin(id: string) {
    const [row] = await this.db
      .select()
      .from(paymentDepositSettings)
      .where(eq(paymentDepositSettings.id, id))
      .limit(1);
    return row ? toAdminDeposit(row) : null;
  }
  private values(
    input: DepositSettingsInput,
    administratorId: string,
    current?: DepositRow,
  ) {
    return {
      displayName: input.displayName,
      bankName: input.bankName,
      accountHolder: input.accountHolder,
      referenceText: input.referenceText,
      instructions: input.instructions,
      whatsappNumber: input.whatsappNumber,
      whatsappTemplate: input.whatsappTemplate,
      showAccountNumber: input.showAccountNumber,
      showClabe: input.showClabe,
      showCardNumber: input.showCardNumber,
      showBank: input.showBank,
      showHolder: input.showHolder,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      accountNumberEncrypted: resolveSensitiveField(
        input.accountNumber,
        input.clearAccountNumber,
        current?.accountNumberEncrypted,
      ),
      clabeEncrypted: resolveSensitiveField(
        input.clabe,
        input.clearClabe,
        current?.clabeEncrypted,
      ),
      cardNumberEncrypted: resolveSensitiveField(
        input.cardNumber,
        input.clearCardNumber,
        current?.cardNumberEncrypted,
      ),
      updatedAt: new Date(),
      updatedBy: administratorId,
    };
  }
  async createDeposit(input: DepositSettingsInput, administratorId: string) {
    let business = await this.getBusiness();
    if (!business) business = await this.saveBusiness(EMPTY, administratorId);
    const [created] = await this.db
      .insert(paymentDepositSettings)
      .values({
        ...this.values(input, administratorId),
        businessSettingsId: business.id,
      })
      .returning();
    if (!created) throw new Error("No se pudo crear la opción");
    return toAdminDeposit(created);
  }
  async updateDeposit(
    id: string,
    input: DepositSettingsInput,
    administratorId: string,
  ) {
    const current = (
      await this.db
        .select()
        .from(paymentDepositSettings)
        .where(eq(paymentDepositSettings.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    const [updated] = await this.db
      .update(paymentDepositSettings)
      .set(this.values(input, administratorId, current))
      .where(eq(paymentDepositSettings.id, id))
      .returning();
    return updated ? toAdminDeposit(updated) : null;
  }
  async deleteDeposit(id: string) {
    const rows = await this.db
      .delete(paymentDepositSettings)
      .where(eq(paymentDepositSettings.id, id))
      .returning({ id: paymentDepositSettings.id });
    return rows.length > 0;
  }
  async setDepositStatus(
    id: string,
    isActive: boolean,
    administratorId: string,
  ) {
    const [row] = await this.db
      .update(paymentDepositSettings)
      .set({ isActive, updatedAt: new Date(), updatedBy: administratorId })
      .where(eq(paymentDepositSettings.id, id))
      .returning();
    return row ? toAdminDeposit(row) : null;
  }
  async reorderDeposits(
    items: Array<{ id: string; sortOrder: number }>,
    administratorId: string,
  ) {
    await this.db.transaction(async (tx) => {
      for (const item of items)
        await tx
          .update(paymentDepositSettings)
          .set({
            sortOrder: item.sortOrder,
            updatedAt: new Date(),
            updatedBy: administratorId,
          })
          .where(eq(paymentDepositSettings.id, item.id));
    });
    return this.listDepositsAdmin();
  }
  async getPublicBusiness() {
    const b = await this.getBusiness();
    if (!b) return null;
    return {
      businessName: b.businessName,
      address: b.address,
      phone: b.phone,
      email: b.email,
      openingHours: b.openingHours,
      primaryWhatsapp: b.primaryWhatsapp,
      secondaryWhatsapp: b.secondaryWhatsapp,
      social: {
        facebook: b.facebook,
        instagram: b.instagram,
        tiktok: b.tiktok,
        website: b.website,
      },
      logoUrl: b.logoUrl,
      faviconUrl: b.faviconUrl,
      themeColor: b.themeColor,
    };
  }
  async getPublicDeposits() {
    const rows = await this.db
      .select()
      .from(paymentDepositSettings)
      .where(eq(paymentDepositSettings.isActive, true))
      .orderBy(
        asc(paymentDepositSettings.sortOrder),
        asc(paymentDepositSettings.createdAt),
      );
    return { items: rows.map(toPublicDeposit).filter(Boolean) };
  }
}
type DepositRow = typeof paymentDepositSettings.$inferSelect;
export function resolveSensitiveField(
  incoming: string,
  clear: boolean,
  current: string | null | undefined,
) {
  return clear ? null : incoming ? encrypt(incoming) : (current ?? null);
}
function masked(value: string | null) {
  if (!value) return undefined;
  const clear = safeDecrypt(value);
  if (!clear) return undefined;
  return `•••• ${clear.slice(-4)}`;
}
function safeDecrypt(value: string | null) {
  if (!value) return undefined;
  try {
    return decrypt(value);
  } catch {
    return undefined;
  }
}
export function toAdminDeposit(d: DepositRow) {
  return {
    id: d.id,
    displayName: d.displayName,
    bankName: d.bankName,
    accountHolder: d.accountHolder,
    referenceText: d.referenceText,
    instructions: d.instructions,
    whatsappNumber: d.whatsappNumber,
    whatsappTemplate: d.whatsappTemplate,
    showAccountNumber: d.showAccountNumber,
    showClabe: d.showClabe,
    showCardNumber: d.showCardNumber,
    showBank: d.showBank,
    showHolder: d.showHolder,
    isActive: d.isActive,
    sortOrder: d.sortOrder,
    createdAt: d.createdAt,
    hasAccountNumber: !!d.accountNumberEncrypted,
    hasClabe: !!d.clabeEncrypted,
    hasCardNumber: !!d.cardNumberEncrypted,
    maskedAccountNumber: masked(d.accountNumberEncrypted),
    maskedClabe: masked(d.clabeEncrypted),
    maskedCardNumber: masked(d.cardNumberEncrypted),
  };
}
export function toPublicDeposit(d: DepositRow | undefined) {
  if (!d?.isActive) return null;
  return {
    id: d.id,
    displayName: d.displayName,
    bankName: d.showBank ? d.bankName : undefined,
    accountHolder: d.showHolder ? d.accountHolder : undefined,
    accountNumber:
      d.showAccountNumber && d.accountNumberEncrypted
        ? safeDecrypt(d.accountNumberEncrypted)
        : undefined,
    clabe:
      d.showClabe && d.clabeEncrypted ? safeDecrypt(d.clabeEncrypted) : undefined,
    cardNumber:
      d.showCardNumber && d.cardNumberEncrypted
        ? safeDecrypt(d.cardNumberEncrypted)
        : undefined,
    referenceText: d.referenceText,
    instructions: d.instructions,
    whatsappNumber: d.whatsappNumber,
    whatsappTemplate: d.whatsappTemplate,
  };
}
