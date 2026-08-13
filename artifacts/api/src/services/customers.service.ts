import { and, asc, count, desc, eq, gt, ilike, isNull, or } from "drizzle-orm";
import {
  customerAuthTokens,
  customerCredentials,
  customerLoyaltyBalance,
  customerLoyaltyMovements,
  customerPublicTokens,
  customerRewards,
  customers,
  loyaltySettings,
  type createDatabase,
} from "@mi-bicla/db";
import { generateSessionToken, sha256 } from "@mi-bicla/shared";
import type {
  CustomerProfileUpdate,
  CustomerCreateInput,
  CustomerUpdateInput,
} from "@mi-bicla/api-contract";
type Db = ReturnType<typeof createDatabase>["db"];
export class CustomersService {
  constructor(private db: Db) {}
  async list(query: {
    search: string;
    status: string;
    page: number;
    pageSize: number;
  }) {
    const filters = [isNull(customers.deletedAt)];
    if (query.status !== "all")
      filters.push(eq(customers.status, query.status));
    if (query.search)
      filters.push(
        or(
          ilike(customers.firstName, `%${query.search}%`),
          ilike(customers.lastName, `%${query.search}%`),
          ilike(customers.phone, `%${query.search}%`),
          ilike(customers.email, `%${query.search}%`),
        )!,
      );
    const where = and(...filters),
      items = await this.db
        .select()
        .from(customers)
        .where(where)
        .orderBy(asc(customers.lastName), asc(customers.firstName))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      [total] = await this.db
        .select({ value: count() })
        .from(customers)
        .where(where);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: total?.value ?? 0,
    };
  }
  async create(input: CustomerCreateInput, administratorId: string) {
    const token = generateSessionToken();
    const customer = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(customers)
        .values({
          ...input,
          createdBy: administratorId,
          updatedBy: administratorId,
        })
        .returning();
      if (!row) throw new Error("No se pudo crear el cliente");
      await tx.insert(customerLoyaltyBalance).values({ customerId: row.id });
      await tx
        .insert(customerPublicTokens)
        .values({ customerId: row.id, publicTokenHash: sha256(token) });
      return row;
    });
    return { customer, publicToken: token };
  }
  async get(id: string) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1);
    if (!customer) return null;
    const [[balance], rewards, [credential], [loyaltyProgram]] = await Promise.all([
      this.db
        .select()
        .from(customerLoyaltyBalance)
        .where(eq(customerLoyaltyBalance.customerId, id))
        .limit(1),
      this.db
        .select()
        .from(customerRewards)
        .where(eq(customerRewards.customerId, id))
        .orderBy(asc(customerRewards.createdAt)),
      this.db
        .select({ id: customerCredentials.id, status: customerCredentials.status })
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, id))
        .limit(1),
      this.db.select({
        enabled: loyaltySettings.enabled,
        allowManualAdjustments: loyaltySettings.allowManualAdjustments,
      }).from(loyaltySettings).limit(1),
    ]);
    // Únicamente lo necesario para que el panel decida qué botón mostrar —
    // nunca passwordHash, tokenHash ni el token crudo.
    let activationExpiresAt: Date | null = null;
    if (credential) {
      const [activeActivation] = await this.db
        .select({ expiresAt: customerAuthTokens.expiresAt })
        .from(customerAuthTokens)
        .where(and(
          eq(customerAuthTokens.credentialId, credential.id),
          eq(customerAuthTokens.purpose, "activation"),
          isNull(customerAuthTokens.consumedAt),
          isNull(customerAuthTokens.revokedAt),
          gt(customerAuthTokens.expiresAt, new Date()),
        ))
        .orderBy(desc(customerAuthTokens.expiresAt))
        .limit(1);
      activationExpiresAt = activeActivation?.expiresAt ?? null;
    }
    return {
      customer,
      balance: balance ?? {
        availableUnits: 0,
        pendingUnits: 0,
        lifetimeUnits: 0,
        updatedAt: customer.updatedAt,
      },
      rewards,
      loyaltyProgram: loyaltyProgram ?? null,
      credentialStatus: credential?.status ?? null,
      activationExpiresAt,
      hasActiveActivation: activationExpiresAt !== null,
    };
  }
  async update(
    id: string,
    input: CustomerUpdateInput,
    administratorId: string,
  ) {
    const values: Partial<typeof customers.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: administratorId,
    };
    if (input.firstName !== undefined) values.firstName = input.firstName;
    if (input.lastName !== undefined) values.lastName = input.lastName;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.email !== undefined) values.email = input.email;
    if (input.birthDate !== undefined) values.birthDate = input.birthDate;
    if (input.notes !== undefined) values.notes = input.notes;
    if (input.status !== undefined) values.status = input.status;
    const [row] = await this.db
      .update(customers)
      .set(values)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning();
    return row ?? null;
  }
  async updateProfile(customerId: string, input: CustomerProfileUpdate) {
    const [row] = await this.db.update(customers).set({
      ...input,
      updatedAt: new Date(),
    }).where(and(
      eq(customers.id, customerId),
      eq(customers.status, "active"),
      isNull(customers.deletedAt),
    )).returning({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      email: customers.email,
      birthDate: customers.birthDate,
      updatedAt: customers.updatedAt,
    });
    return row ? { ...row, name: `${row.firstName} ${row.lastName}`, accountStatus: "active" as const } : null;
  }
  async remove(id: string, administratorId: string) {
    const [row] = await this.db
      .update(customers)
      .set({
        deletedAt: new Date(),
        status: "inactive",
        updatedAt: new Date(),
        updatedBy: administratorId,
      })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning({ id: customers.id });
    return !!row;
  }
  async regenerateToken(customerId: string) {
    const token = generateSessionToken();
    await this.db.transaction(async (tx) => {
      await tx
        .update(customerPublicTokens)
        .set({ active: false })
        .where(eq(customerPublicTokens.customerId, customerId));
      await tx
        .insert(customerPublicTokens)
        .values({ customerId, publicTokenHash: sha256(token) });
    });
    return token;
  }
  async getPublic(token: string) {
    const hash = sha256(token),
      now = new Date();
    const [row] = await this.db
      .select({ token: customerPublicTokens, customer: customers })
      .from(customerPublicTokens)
      .innerJoin(customers, eq(customerPublicTokens.customerId, customers.id))
      .where(
        and(
          eq(customerPublicTokens.publicTokenHash, hash),
          eq(customerPublicTokens.active, true),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);
    if (!row || (row.token.expiresAt && row.token.expiresAt <= now))
      return null;
    await this.db
      .update(customerPublicTokens)
      .set({ lastUsedAt: now })
      .where(eq(customerPublicTokens.id, row.token.id));
    const loyalty = await this.getLoyalty(row.customer.id);
    if (!loyalty) return null;
    const { movements, ...publicCard } = loyalty;
    void movements;
    return publicCard;
  }
  async getLoyalty(customerId: string) {
    const now = new Date();
    const [[customer], [balance], rewards, movements, [loyaltyProgram]] = await Promise.all([
      this.db.select({
        firstName: customers.firstName,
        lastName: customers.lastName,
        updatedAt: customers.updatedAt,
      }).from(customers).where(and(
        eq(customers.id, customerId),
        eq(customers.status, "active"),
        isNull(customers.deletedAt),
      )).limit(1),
      this.db.select({
        availableUnits: customerLoyaltyBalance.availableUnits,
        pendingUnits: customerLoyaltyBalance.pendingUnits,
        lifetimeUnits: customerLoyaltyBalance.lifetimeUnits,
        updatedAt: customerLoyaltyBalance.updatedAt,
      }).from(customerLoyaltyBalance)
        .where(eq(customerLoyaltyBalance.customerId, customerId)).limit(1),
      this.db.select({
        id: customerRewards.id,
        rewardName: customerRewards.rewardName,
        rewardDiscountPercent: customerRewards.rewardDiscountPercent,
        requiredUnits: customerRewards.requiredUnits,
        status: customerRewards.status,
        createdAt: customerRewards.createdAt,
        expiresAt: customerRewards.expiresAt,
      }).from(customerRewards).where(and(
        eq(customerRewards.customerId, customerId),
        eq(customerRewards.status, "available"),
        or(isNull(customerRewards.expiresAt), gt(customerRewards.expiresAt, now)),
      )).orderBy(asc(customerRewards.createdAt)),
      this.db.select({
        id: customerLoyaltyMovements.id,
        units: customerLoyaltyMovements.units,
        balanceAfter: customerLoyaltyMovements.balanceAfter,
        reason: customerLoyaltyMovements.reason,
        movementType: customerLoyaltyMovements.movementType,
        createdAt: customerLoyaltyMovements.createdAt,
      }).from(customerLoyaltyMovements)
        .where(eq(customerLoyaltyMovements.customerId, customerId))
        .orderBy(desc(customerLoyaltyMovements.createdAt)).limit(10),
      this.db.select().from(loyaltySettings).limit(1),
    ]);
    if (!customer) return null;
    const safeBalance = balance ?? {
      availableUnits: 0,
      pendingUnits: 0,
      lifetimeUnits: 0,
      updatedAt: customer.updatedAt,
    };
    return {
      name: `${customer.firstName} ${customer.lastName}`,
      balance: safeBalance,
      rewards,
      movements,
      loyaltyProgram: loyaltyProgram ? {
        enabled: loyaltyProgram.enabled,
        rewardUnits: loyaltyProgram.rewardUnits,
        rewardName: loyaltyProgram.rewardName,
        rewardDescription: loyaltyProgram.rewardDescription,
      } : null,
      updatedAt: safeBalance.updatedAt,
    };
  }
  async resolvePublicToken(token: string) {
    const now = new Date();
    const [match] = await this.db
      .select({ token: customerPublicTokens, customer: customers })
      .from(customerPublicTokens)
      .innerJoin(customers, eq(customerPublicTokens.customerId, customers.id))
      .where(
        and(
          eq(customerPublicTokens.publicTokenHash, sha256(token)),
          eq(customerPublicTokens.active, true),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);
    if (
      !match ||
      (match.token.expiresAt && match.token.expiresAt <= now)
    )
      return null;
    const [detail, [program]] = await Promise.all([
      this.get(match.customer.id),
      this.db.select().from(loyaltySettings).limit(1),
    ]);
    if (!detail) return null;
    return {
      customer: {
        id: match.customer.id,
        name: `${match.customer.firstName} ${match.customer.lastName}`,
      },
      balance: detail.balance,
      rewards: detail.rewards.filter((reward) => reward.status === "available"),
      loyaltyProgram: program
        ? {
            enabled: program.enabled,
            rewardUnits: program.rewardUnits,
            rewardName: program.rewardName,
            allowManualAdjustments: program.allowManualAdjustments,
          }
        : null,
    };
  }
}
