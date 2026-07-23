import { and, asc, count, eq, ilike, isNull, or } from "drizzle-orm";
import {
  customerLoyaltyBalance,
  customerPublicTokens,
  customerRewards,
  customers,
  loyaltySettings,
  type createDatabase,
} from "@mi-bicla/db";
import { generateSessionToken, sha256 } from "@mi-bicla/shared";
import type {
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
    const [balance] = await this.db
        .select()
        .from(customerLoyaltyBalance)
        .where(eq(customerLoyaltyBalance.customerId, id))
        .limit(1),
      rewards = await this.db
        .select()
        .from(customerRewards)
        .where(eq(customerRewards.customerId, id))
        .orderBy(asc(customerRewards.createdAt));
    return {
      customer,
      balance: balance ?? {
        availableUnits: 0,
        pendingUnits: 0,
        lifetimeUnits: 0,
        updatedAt: customer.updatedAt,
      },
      rewards,
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
    const [detail, [loyaltyProgram]] = await Promise.all([
      this.get(row.customer.id),
      this.db.select().from(loyaltySettings).limit(1),
    ]);
    return detail
      ? {
          name: `${row.customer.firstName} ${row.customer.lastName}`,
          balance: detail.balance,
          rewards: detail.rewards.filter((r) => r.status === "available"),
          loyaltyProgram: loyaltyProgram
            ? {
                enabled: loyaltyProgram.enabled,
                rewardUnits: loyaltyProgram.rewardUnits,
                rewardName: loyaltyProgram.rewardName,
                rewardDescription: loyaltyProgram.rewardDescription,
              }
            : null,
          updatedAt: detail.balance.updatedAt,
        }
      : null;
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
