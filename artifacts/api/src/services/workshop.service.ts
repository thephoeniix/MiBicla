import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  administrators,
  customerBicycles,
  customerLoyaltyBalance,
  customerPublicTokens,
  customers,
  rateLimits,
  workshopCustomerUpdates,
  workshopNotifications,
  workshopOrderParts,
  workshopOrders,
  workshopOrderServices,
  workshopServiceCatalog,
  workshopPublicTokens,
  workshopRequests,
  workshopSettings,
  workshopStatusHistory,
  type createDatabase,
} from "@mi-bicla/db";
import {
  generateSessionToken,
  hashRateLimitKey,
  LOGIN_WINDOW_MS,
  sha256,
} from "@mi-bicla/shared";
import type { z } from "zod";
import type {
  CustomerBicycleInput,
  CustomerBicycleUpdate,
  CustomerWorkshopRequest,
  bicycleSchema,
  workshopOrderSchema,
  workshopPartSchema,
  workshopRequestSchema,
  workshopServiceSchema,
  workshopStatusSchema,
  workshopUpdateSchema,
  workshopServiceCatalogSchema,
} from "@mi-bicla/api-contract";
type Db = ReturnType<typeof createDatabase>["db"];
type Bicycle = z.infer<typeof bicycleSchema>;
type RequestInput = z.infer<typeof workshopRequestSchema>;
type OrderInput = z.infer<typeof workshopOrderSchema>;
type Line = z.infer<typeof workshopServiceSchema>;
type CatalogService = z.infer<typeof workshopServiceCatalogSchema>;
type Part = z.infer<typeof workshopPartSchema>;
type Update = z.infer<typeof workshopUpdateSchema>;
type Status = z.infer<typeof workshopStatusSchema>;
export const STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  received: ["inspection"],
  inspection: ["in_progress"],
  in_progress: ["waiting_parts", "quality_check"],
  waiting_parts: ["in_progress"],
  quality_check: ["ready", "in_progress"],
  ready: ["delivered"],
  delivered: [],
};
export function canTransition(from: string, to: string) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
export function calculateWorkshopTotals(
  services: Array<{ status: string; totalCents: number }>,
  parts: Array<{ status: string; totalCents: number }>,
  discount: number,
) {
  const subtotalServicesCents = services
      .filter((x) => x.status !== "cancelled")
      .reduce((s, x) => s + x.totalCents, 0),
    subtotalPartsCents = parts
      .filter((x) => x.status !== "cancelled")
      .reduce((s, x) => s + x.totalCents, 0);
  return {
    subtotalServicesCents,
    subtotalPartsCents,
    totalCents: Math.max(
      0,
      subtotalServicesCents + subtotalPartsCents - discount,
    ),
  };
}
export function workshopWhatsappUrl(
  phone: string,
  template: string,
  values: Record<string, string>,
) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(template.replace(/\{([a-z_]+)\}/g, (_, k: string) => values[k] ?? ""))}`;
}
const num = (prefix: string) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export class WorkshopService {
  constructor(private db: Db) {}
  async getSettings() {
    return (await this.db.select().from(workshopSettings).limit(1))[0] ?? null;
  }
  async saveSettings(
    input: {
      publicRequestsEnabled: boolean;
      publicTrackingEnabled: boolean;
      allowCustomerPhotos: boolean;
      defaultEstimatedDays: number | null;
      readyWhatsappTemplate: string;
      statusWhatsappTemplates: Record<string, string>;
      publicStatusLabels: Record<string, string>;
    },
    admin: string,
  ) {
    const current = await this.getSettings(),
      values = { ...input, updatedAt: new Date(), updatedBy: admin };
    if (current) {
      const [row] = await this.db
        .update(workshopSettings)
        .set(values)
        .where(eq(workshopSettings.id, current.id))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(workshopSettings)
      .values(values)
      .returning();
    return row;
  }
  async rateLimit(ip: string, kind = "request") {
    const start = new Date(
        Math.floor(Date.now() / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS,
      ),
      hash = hashRateLimitKey(`workshop:${kind}:${ip}`),
      [row] = await this.db
        .insert(rateLimits)
        .values({
          scope: `workshop-${kind}`,
          keyHash: hash,
          windowStartedAt: start,
          expiresAt: new Date(start.getTime() + LOGIN_WINDOW_MS),
        })
        .onConflictDoUpdate({
          target: [
            rateLimits.scope,
            rateLimits.keyHash,
            rateLimits.windowStartedAt,
          ],
          set: {
            attemptCount: sql`${rateLimits.attemptCount}+1`,
            updatedAt: new Date(),
          },
        })
        .returning({ count: rateLimits.attemptCount });
    return (row?.count ?? 1) > 5;
  }
  async publicRequestsEnabled() {
    const [s] = await this.db.select().from(workshopSettings).limit(1);
    return s?.publicRequestsEnabled ?? true;
  }
  async createRequest(input: RequestInput) {
    const [row] = await this.db
      .insert(workshopRequests)
      .values({ ...input, requestNumber: num("SOL"), status: "pending" })
      .returning();
    return row;
  }
  listRequests() {
    return this.db
      .select()
      .from(workshopRequests)
      .orderBy(asc(workshopRequests.createdAt));
  }
  async getRequest(id: string) {
    return (
      (
        await this.db
          .select()
          .from(workshopRequests)
          .where(eq(workshopRequests.id, id))
          .limit(1)
      )[0] ?? null
    );
  }
  async requestStatus(
    id: string,
    status: string,
    admin: string,
    rejectionReason: string | null,
  ) {
    const [row] = await this.db
      .update(workshopRequests)
      .set({
        status,
        reviewedAt: new Date(),
        reviewedBy: admin,
        rejectionReason,
      })
      .where(eq(workshopRequests.id, id))
      .returning();
    return row ?? null;
  }
  async listBicycles(customerId?: string) {
    return this.db
      .select()
      .from(customerBicycles)
      .where(
        and(
          isNull(customerBicycles.deletedAt),
          customerId ? eq(customerBicycles.customerId, customerId) : undefined,
        ),
      )
      .orderBy(asc(customerBicycles.createdAt));
  }
  listCustomerBicycles(customerId: string) {
    return this.db.select({
      id: customerBicycles.id,
      nickname: customerBicycles.nickname,
      brand: customerBicycles.brand,
      model: customerBicycles.model,
      year: customerBicycles.year,
      bikeType: customerBicycles.bikeType,
      color: customerBicycles.color,
      wheelSize: customerBicycles.wheelSize,
      brakeType: customerBicycles.brakeType,
      suspensionType: customerBicycles.suspensionType,
      drivetrain: customerBicycles.drivetrain,
      generalCondition: customerBicycles.generalCondition,
      serialNumber: customerBicycles.serialNumber,
      frameNumber: customerBicycles.frameNumber,
      photoUrl: customerBicycles.photoUrl,
      status: customerBicycles.status,
      updatedAt: customerBicycles.updatedAt,
    }).from(customerBicycles).where(and(
      eq(customerBicycles.customerId, customerId),
      isNull(customerBicycles.deletedAt),
    )).orderBy(asc(customerBicycles.createdAt));
  }
  async createCustomerBicycle(customerId: string, input: CustomerBicycleInput) {
    const [row] = await this.db.insert(customerBicycles).values({
      ...input,
      customerId,
      status: "active",
    }).returning();
    return row ?? null;
  }
  async updateCustomerBicycle(
    customerId: string,
    bicycleId: string,
    input: CustomerBicycleUpdate,
  ) {
    const [row] = await this.db.update(customerBicycles).set({
      ...input,
      updatedAt: new Date(),
    }).where(and(
      eq(customerBicycles.id, bicycleId),
      eq(customerBicycles.customerId, customerId),
      isNull(customerBicycles.deletedAt),
    )).returning();
    return row ?? null;
  }
  listCustomerRequests(customerId: string) {
    return this.db.select({
      requestNumber: workshopRequests.requestNumber,
      bicycleId: workshopRequests.bicycleId,
      problemDescription: workshopRequests.problemDescription,
      status: workshopRequests.status,
      createdAt: workshopRequests.createdAt,
      convertedOrderId: workshopRequests.convertedOrderId,
    }).from(workshopRequests).where(eq(workshopRequests.customerId, customerId))
      .orderBy(desc(workshopRequests.createdAt));
  }
  async createCustomerWorkshopRequest(
    customerId: string,
    input: CustomerWorkshopRequest,
  ) {
    return this.db.transaction(async (tx) => {
      const [[customer], [bike]] = await Promise.all([
        tx.select().from(customers).where(and(
          eq(customers.id, customerId),
          eq(customers.status, "active"),
          isNull(customers.deletedAt),
        )).limit(1),
        tx.select().from(customerBicycles).where(and(
          eq(customerBicycles.id, input.bicycleId),
          eq(customerBicycles.customerId, customerId),
          isNull(customerBicycles.deletedAt),
        )).limit(1),
      ]);
      if (!customer || !bike) return null;
      const description = input.serviceName
        ? `${input.serviceName}\n\n${input.problemDescription}`
        : input.problemDescription;
      const [request] = await tx.insert(workshopRequests).values({
        requestNumber: num("SOL"),
        customerId,
        bicycleId: bike.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        bikeBrand: bike.brand,
        bikeModel: bike.model,
        bikeType: bike.bikeType,
        problemDescription: description,
        preferredContactMethod: input.preferredContactMethod,
        status: "pending",
      }).returning({
        requestNumber: workshopRequests.requestNumber,
        status: workshopRequests.status,
        createdAt: workshopRequests.createdAt,
      });
      return request ?? null;
    });
  }
  async createBicycle(input: Bicycle, admin: string) {
    const [row] = await this.db
      .insert(customerBicycles)
      .values({ ...input, createdBy: admin, updatedBy: admin })
      .returning();
    return row;
  }
  async getBicycle(id: string) {
    return (
      (
        await this.db
          .select()
          .from(customerBicycles)
          .where(
            and(
              eq(customerBicycles.id, id),
              isNull(customerBicycles.deletedAt),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
  }
  async updateBicycle(id: string, input: Partial<Bicycle>, admin: string) {
    const [row] = await this.db
      .update(customerBicycles)
      .set({ ...input, updatedAt: new Date(), updatedBy: admin })
      .where(
        and(eq(customerBicycles.id, id), isNull(customerBicycles.deletedAt)),
      )
      .returning();
    return row ?? null;
  }
  async deleteBicycle(id: string, admin: string) {
    const [row] = await this.db
      .update(customerBicycles)
      .set({
        deletedAt: new Date(),
        status: "inactive",
        updatedAt: new Date(),
        updatedBy: admin,
      })
      .where(eq(customerBicycles.id, id))
      .returning({ id: customerBicycles.id });
    return !!row;
  }
  listServiceCatalog(includeInactive = false) {
    return this.db
      .select()
      .from(workshopServiceCatalog)
      .where(
        and(
          isNull(workshopServiceCatalog.deletedAt),
          includeInactive
            ? undefined
            : eq(workshopServiceCatalog.isActive, true),
        ),
      )
      .orderBy(
        asc(workshopServiceCatalog.sortOrder),
        asc(workshopServiceCatalog.name),
      );
  }
  async createCatalogService(input: CatalogService, admin: string) {
    const [row] = await this.db
      .insert(workshopServiceCatalog)
      .values({ ...input, createdBy: admin, updatedBy: admin })
      .returning();
    return row;
  }
  async updateCatalogService(
    id: string,
    input: Partial<CatalogService>,
    admin: string,
  ) {
    const [row] = await this.db
      .update(workshopServiceCatalog)
      .set({ ...input, updatedAt: new Date(), updatedBy: admin })
      .where(
        and(
          eq(workshopServiceCatalog.id, id),
          isNull(workshopServiceCatalog.deletedAt),
        ),
      )
      .returning();
    return row ?? null;
  }
  async deleteCatalogService(id: string, admin: string) {
    const [usage] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workshopOrderServices)
      .where(eq(workshopOrderServices.catalogServiceId, id));
    if ((usage?.count ?? 0) > 0) {
      await this.db
        .update(workshopServiceCatalog)
        .set({
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: admin,
        })
        .where(eq(workshopServiceCatalog.id, id));
      return "deactivated" as const;
    }
    await this.db
      .delete(workshopServiceCatalog)
      .where(eq(workshopServiceCatalog.id, id));
    return "deleted" as const;
  }
  listTechnicians() {
    return this.db
      .select({ id: administrators.id, name: administrators.name })
      .from(administrators)
      .where(eq(administrators.isActive, true))
      .orderBy(asc(administrators.name));
  }
  async convertRequest(
    id: string,
    ids: { customerId?: string; bicycleId?: string },
    admin: string,
  ) {
    const token = generateSessionToken();
    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(workshopRequests)
        .where(eq(workshopRequests.id, id))
        .limit(1);
      if (!request || request.status === "converted")
        throw new Error("Solicitud no disponible");
      let customerId = ids.customerId ?? request.customerId ?? undefined;
      if (!customerId) {
        const names = request.customerName.trim().split(/\s+/),
          [customer] = await tx
            .insert(customers)
            .values({
              firstName: names.shift() ?? request.customerName,
              lastName: names.join(" ") || "Sin apellido",
              phone: request.customerPhone,
              email: request.customerEmail,
              status: "active",
              createdBy: admin,
              updatedBy: admin,
            })
            .returning();
        if (!customer) throw new Error("No se pudo crear cliente");
        customerId = customer.id;
        const customerToken = generateSessionToken();
        await tx.insert(customerLoyaltyBalance).values({ customerId });
        await tx
          .insert(customerPublicTokens)
          .values({ customerId, publicTokenHash: sha256(customerToken) });
      }
      const requestBelongsToCustomer = customerId === request.customerId;
      let bicycleId = ids.bicycleId ??
        (requestBelongsToCustomer ? request.bicycleId ?? undefined : undefined);
      if (!bicycleId) {
        const [bike] = await tx
          .insert(customerBicycles)
          .values({
            customerId,
            brand: request.bikeBrand,
            model: request.bikeModel,
            bikeType: request.bikeType,
            status: "active",
            createdBy: admin,
            updatedBy: admin,
          })
          .returning();
        if (!bike) throw new Error("No se pudo crear bicicleta");
        bicycleId = bike.id;
      } else {
        const [ownedBicycle] = await tx.select({ id: customerBicycles.id })
          .from(customerBicycles).where(and(
            eq(customerBicycles.id, bicycleId),
            eq(customerBicycles.customerId, customerId),
            isNull(customerBicycles.deletedAt),
          )).limit(1);
        if (!ownedBicycle) throw new Error("La bicicleta no pertenece al cliente");
      }
      const [order] = await tx
        .insert(workshopOrders)
        .values({
          orderNumber: num("OT"),
          customerId,
          bicycleId,
          requestId: request.id,
          problemDescription: request.problemDescription,
          status: "received",
          createdBy: admin,
          updatedBy: admin,
        })
        .returning();
      if (!order) throw new Error("No se pudo crear orden");
      await tx
        .insert(workshopPublicTokens)
        .values({ workshopOrderId: order.id, tokenHash: sha256(token) });
      await tx.insert(workshopStatusHistory).values({
        workshopOrderId: order.id,
        newStatus: "received",
        changedBy: admin,
        publicMessage: null,
      });
      await tx
        .update(workshopRequests)
        .set({
          status: "converted",
          convertedOrderId: order.id,
          customerId,
          bicycleId,
          reviewedAt: new Date(),
          reviewedBy: admin,
        })
        .where(eq(workshopRequests.id, id));
      return { order, publicToken: token };
    });
  }
  async createOrder(input: OrderInput, admin: string) {
    const token = generateSessionToken();
    return this.db.transaction(async (tx) => {
      const [ownedBicycle] = await tx.select({ id: customerBicycles.id })
        .from(customerBicycles).where(and(
          eq(customerBicycles.id, input.bicycleId),
          eq(customerBicycles.customerId, input.customerId),
          isNull(customerBicycles.deletedAt),
        )).limit(1);
      if (!ownedBicycle) throw new Error("La bicicleta no pertenece al cliente");
      const [order] = await tx
        .insert(workshopOrders)
        .values({
          ...input,
          estimatedCompletionAt: input.estimatedCompletionAt
            ? new Date(input.estimatedCompletionAt)
            : null,
          orderNumber: num("OT"),
          createdBy: admin,
          updatedBy: admin,
          status: "received",
        })
        .returning();
      if (!order) throw new Error("No se pudo crear orden");
      await tx
        .insert(workshopPublicTokens)
        .values({ workshopOrderId: order.id, tokenHash: sha256(token) });
      await tx.insert(workshopStatusHistory).values({
        workshopOrderId: order.id,
        newStatus: "received",
        changedBy: admin,
        publicMessage: null,
      });
      return { order, publicToken: token };
    });
  }
  listOrders() {
    return this.db
      .select()
      .from(workshopOrders)
      .orderBy(asc(workshopOrders.createdAt));
  }
  async listCustomerOrders(customerId: string) {
    const [settings] = await this.db.select().from(workshopSettings).limit(1);
    const labels = settings?.publicStatusLabels ?? {};
    const rows = await this.db.select({ order: workshopOrders, bike: customerBicycles })
      .from(workshopOrders)
      .innerJoin(customerBicycles, and(
        eq(workshopOrders.bicycleId, customerBicycles.id),
        eq(customerBicycles.customerId, customerId),
        isNull(customerBicycles.deletedAt),
      ))
      .where(eq(workshopOrders.customerId, customerId))
      .orderBy(desc(workshopOrders.updatedAt));
    return rows.map(({ order, bike }) => ({
      orderNumber: order.orderNumber,
      bicycle: {
        id: bike.id,
        nickname: bike.nickname,
        brand: bike.brand,
        model: bike.model,
        photoUrl: bike.photoUrl,
      },
      publicStatus: labels[order.status] ?? order.status,
      customerVisibleSummary: order.customerVisibleSummary,
      estimatedCompletionAt: order.estimatedCompletionAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      totalCents: order.totalCents,
      paymentStatus: order.paymentStatus,
      isActive: !["delivered", "cancelled"].includes(order.status),
      updatedAt: order.updatedAt,
    }));
  }
  async getCustomerOrder(customerId: string, orderNumber: string) {
    const [[match], [settings]] = await Promise.all([
      this.db.select({ order: workshopOrders, bike: customerBicycles })
        .from(workshopOrders)
        .innerJoin(customerBicycles, and(
          eq(workshopOrders.bicycleId, customerBicycles.id),
          eq(customerBicycles.customerId, customerId),
          isNull(customerBicycles.deletedAt),
        ))
        .where(and(
          eq(workshopOrders.orderNumber, orderNumber),
          eq(workshopOrders.customerId, customerId),
        )).limit(1),
      this.db.select().from(workshopSettings).limit(1),
    ]);
    if (!match) return null;
    const detail = await this.customerOrderProjection(
      match.order,
      match.bike,
      settings?.publicStatusLabels ?? {},
    );
    return detail ? {
      ...detail,
      totalCents: match.order.totalCents,
      paymentStatus: match.order.paymentStatus,
    } : null;
  }
  async getOrder(id: string, includeFinancial = false) {
    const [order] = await this.db
      .select()
      .from(workshopOrders)
      .where(eq(workshopOrders.id, id))
      .limit(1);
    if (!order) return null;
    const [services, parts, history, updates] = await Promise.all([
      this.db
        .select()
        .from(workshopOrderServices)
        .where(eq(workshopOrderServices.workshopOrderId, id)),
      this.db
        .select()
        .from(workshopOrderParts)
        .where(eq(workshopOrderParts.workshopOrderId, id)),
      this.db
        .select()
        .from(workshopStatusHistory)
        .where(eq(workshopStatusHistory.workshopOrderId, id))
        .orderBy(asc(workshopStatusHistory.createdAt)),
      this.db
        .select()
        .from(workshopCustomerUpdates)
        .where(eq(workshopCustomerUpdates.workshopOrderId, id))
        .orderBy(asc(workshopCustomerUpdates.createdAt)),
    ]);
    if (includeFinancial) return { order, services, parts, history, updates };
    const {
      subtotalServicesCents,
      subtotalPartsCents,
      discountCents,
      totalCents,
      amountPaidCents,
      paymentStatus,
      ...safeOrder
    } = order;
    void subtotalServicesCents;
    void subtotalPartsCents;
    void discountCents;
    void totalCents;
    void amountPaidCents;
    void paymentStatus;
    return {
      order: safeOrder,
      services: services.map(({ unitPriceCents, totalCents, ...x }) => {
        void unitPriceCents;
        void totalCents;
        return x;
      }),
      parts: parts.map(({ unitPriceCents, totalCents, ...x }) => {
        void unitPriceCents;
        void totalCents;
        return x;
      }),
      history,
      updates,
    };
  }
  async updateOrder(id: string, input: Record<string, unknown>, admin: string) {
    const [row] = await this.db
      .update(workshopOrders)
      .set({ ...input, updatedAt: new Date(), updatedBy: admin })
      .where(eq(workshopOrders.id, id))
      .returning();
    return row ?? null;
  }
  async status(id: string, input: Status, admin: string, isOwner: boolean) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(workshopOrders)
        .where(eq(workshopOrders.id, id))
        .limit(1);
      if (!order) throw new Error("Orden no encontrada");
      if (
        !canTransition(order.status, input.status) &&
        !(isOwner && input.force && input.internalReason)
      )
        throw new Error("Transición de estado no permitida");
      const now = new Date(),
        extra =
          input.status === "ready"
            ? { readyAt: now }
            : input.status === "delivered"
              ? { deliveredAt: now }
              : input.status === "cancelled"
                ? { cancelledAt: now, cancellationReason: input.internalReason }
                : {};
      await tx
        .update(workshopOrders)
        .set({
          status: input.status,
          ...extra,
          updatedAt: now,
          updatedBy: admin,
        })
        .where(eq(workshopOrders.id, id));
      await tx.insert(workshopStatusHistory).values({
        workshopOrderId: id,
        previousStatus: order.status,
        newStatus: input.status,
        publicMessage: input.publicMessage,
        internalReason: input.internalReason,
        changedBy: admin,
        customerVisible: input.customerVisible,
      });
      return { status: input.status };
    });
  }
  async recalc(orderId: string, tx: Db = this.db) {
    const [order] = await tx
        .select()
        .from(workshopOrders)
        .where(eq(workshopOrders.id, orderId))
        .limit(1),
      services = await tx
        .select({
          status: workshopOrderServices.status,
          totalCents: workshopOrderServices.totalCents,
        })
        .from(workshopOrderServices)
        .where(eq(workshopOrderServices.workshopOrderId, orderId)),
      parts = await tx
        .select({
          status: workshopOrderParts.status,
          totalCents: workshopOrderParts.totalCents,
        })
        .from(workshopOrderParts)
        .where(eq(workshopOrderParts.workshopOrderId, orderId));
    if (!order) return null;
    const totals = calculateWorkshopTotals(
      services,
      parts,
      order.discountCents,
    );
    await tx
      .update(workshopOrders)
      .set({ ...totals, updatedAt: new Date() })
      .where(eq(workshopOrders.id, orderId));
    return totals;
  }
  async addService(orderId: string, input: Line) {
    const [row] = await this.db
      .insert(workshopOrderServices)
      .values({
        ...input,
        workshopOrderId: orderId,
        totalCents: input.quantity * input.unitPriceCents,
      })
      .returning();
    await this.recalc(orderId);
    return row;
  }
  async updateService(id: string, input: Partial<Line>) {
    const current = (
      await this.db
        .select()
        .from(workshopOrderServices)
        .where(eq(workshopOrderServices.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    const quantity = input.quantity ?? current.quantity,
      price = input.unitPriceCents ?? current.unitPriceCents,
      [row] = await this.db
        .update(workshopOrderServices)
        .set({
          ...input,
          quantity,
          unitPriceCents: price,
          totalCents: quantity * price,
          updatedAt: new Date(),
        })
        .where(eq(workshopOrderServices.id, id))
        .returning();
    await this.recalc(current.workshopOrderId);
    return row;
  }
  async deleteService(id: string) {
    const [row] = await this.db
      .delete(workshopOrderServices)
      .where(eq(workshopOrderServices.id, id))
      .returning();
    if (row) await this.recalc(row.workshopOrderId);
    return !!row;
  }
  async addPart(orderId: string, input: Part) {
    const [row] = await this.db
      .insert(workshopOrderParts)
      .values({
        ...input,
        workshopOrderId: orderId,
        totalCents: input.quantity * input.unitPriceCents,
      })
      .returning();
    await this.recalc(orderId);
    return row;
  }
  async updatePart(id: string, input: Partial<Part>) {
    const current = (
      await this.db
        .select()
        .from(workshopOrderParts)
        .where(eq(workshopOrderParts.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    const quantity = input.quantity ?? current.quantity,
      price = input.unitPriceCents ?? current.unitPriceCents,
      [row] = await this.db
        .update(workshopOrderParts)
        .set({
          ...input,
          quantity,
          unitPriceCents: price,
          totalCents: quantity * price,
          updatedAt: new Date(),
        })
        .where(eq(workshopOrderParts.id, id))
        .returning();
    await this.recalc(current.workshopOrderId);
    return row;
  }
  async deletePart(id: string) {
    const [row] = await this.db
      .delete(workshopOrderParts)
      .where(eq(workshopOrderParts.id, id))
      .returning();
    if (row) await this.recalc(row.workshopOrderId);
    return !!row;
  }
  async addUpdate(orderId: string, input: Update, admin: string) {
    const [row] = await this.db
      .insert(workshopCustomerUpdates)
      .values({ ...input, workshopOrderId: orderId, createdBy: admin })
      .returning();
    return row;
  }
  async updateUpdate(id: string, input: Partial<Update>) {
    const [row] = await this.db
      .update(workshopCustomerUpdates)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(workshopCustomerUpdates.id, id))
      .returning();
    return row ?? null;
  }
  async deleteUpdate(id: string) {
    return !!(
      await this.db
        .delete(workshopCustomerUpdates)
        .where(eq(workshopCustomerUpdates.id, id))
        .returning({ id: workshopCustomerUpdates.id })
    )[0];
  }
  async regenerateToken(orderId: string) {
    const token = generateSessionToken();
    await this.db.transaction(async (tx) => {
      await tx
        .update(workshopPublicTokens)
        .set({ active: false, revokedAt: new Date() })
        .where(eq(workshopPublicTokens.workshopOrderId, orderId));
      await tx
        .insert(workshopPublicTokens)
        .values({ workshopOrderId: orderId, tokenHash: sha256(token) });
    });
    return token;
  }
  async publicOrder(token: string) {
    const [settings] = await this.db.select().from(workshopSettings).limit(1);
    if (settings && !settings.publicTrackingEnabled) return null;
    const now = new Date(),
      [match] = await this.db
        .select({
          token: workshopPublicTokens,
          order: workshopOrders,
          bike: customerBicycles,
        })
        .from(workshopPublicTokens)
        .innerJoin(
          workshopOrders,
          eq(workshopPublicTokens.workshopOrderId, workshopOrders.id),
        )
        .innerJoin(
          customerBicycles,
          eq(workshopOrders.bicycleId, customerBicycles.id),
        )
        .where(
          and(
            eq(workshopPublicTokens.tokenHash, sha256(token)),
            eq(workshopPublicTokens.active, true),
          ),
        )
        .limit(1);
    if (
      !match ||
      match.token.revokedAt ||
      (match.token.expiresAt && match.token.expiresAt <= now)
    )
      return null;
    await this.db
      .update(workshopPublicTokens)
      .set({ lastUsedAt: now })
      .where(eq(workshopPublicTokens.id, match.token.id));
    return this.customerOrderProjection(
      match.order,
      match.bike,
      settings?.publicStatusLabels ?? {},
    );
  }
  private async customerOrderProjection(
    order: typeof workshopOrders.$inferSelect,
    bike: typeof customerBicycles.$inferSelect,
    labels: Record<string, string>,
  ) {
    const detail = await this.getOrder(order.id);
    if (!detail) return null;
    return {
      orderNumber: order.orderNumber,
      bicycle: {
        nickname: bike.nickname,
        brand: bike.brand,
        model: bike.model,
        bikeType: bike.bikeType,
        color: bike.color,
        photoUrl: bike.photoUrl,
      },
      publicStatus: labels[order.status] ?? order.status,
      customerVisibleSummary: order.customerVisibleSummary,
      estimatedCompletionAt: order.estimatedCompletionAt,
      readyAt: order.readyAt,
      updates: detail.updates
        .filter((x) => x.customerVisible)
        .map(
          ({ id, title, message, progressPercent, photoUrl, createdAt }) => ({
            id,
            title,
            message,
            progressPercent,
            photoUrl,
            createdAt,
          }),
        ),
      visibleServices: detail.services
        .filter((x) => x.isCustomerVisible)
        .map(({ id, serviceName, description, status }) => ({
          id,
          serviceName,
          description,
          status,
        })),
      visibleParts: detail.parts
        .filter((x) => x.isCustomerVisible)
        .map(({ id, partName, brand, description, status }) => ({
          id,
          partName,
          brand,
          description,
          status,
        })),
      history: detail.history
        .filter((x) => x.customerVisible)
        .map(({ id, newStatus, publicMessage, createdAt }) => ({
          id,
          status: labels[newStatus] ?? newStatus,
          publicMessage,
          createdAt,
        })),
      updatedAt: order.updatedAt,
    };
  }
  async whatsapp(orderId: string, admin: string, baseUrl: string) {
    const detail = await this.getOrder(orderId, true);
    if (!detail) throw new Error("Orden no encontrada");
    const [customer] = await this.db
        .select()
        .from(customers)
        .where(eq(customers.id, detail.order.customerId))
        .limit(1),
      [bike] = await this.db
        .select()
        .from(customerBicycles)
        .where(eq(customerBicycles.id, detail.order.bicycleId))
        .limit(1),
      [settings] = await this.db.select().from(workshopSettings).limit(1),
      token = await this.regenerateToken(orderId),
      template =
        settings?.readyWhatsappTemplate ||
        "Hola {nombre}. Tu bicicleta {bicicleta} está {estado}. Orden: {orden}. Seguimiento: {url}";
    const statusLabels: Record<string, string> = {
      received: "recibida",
      inspection: "en inspección",
      in_progress: "en reparación",
      waiting_parts: "esperando piezas",
      quality_check: "en control de calidad",
      ready: "lista para recoger",
      delivered: "entregada",
    };
    const url = workshopWhatsappUrl(customer?.phone ?? "", template, {
      nombre: customer?.firstName ?? "",
      bicicleta: bike?.nickname || bike?.brand || "bicicleta",
      orden: detail.order.orderNumber,
      estado: statusLabels[detail.order.status] ?? detail.order.status,
      total: (
        ("totalCents" in detail.order
          ? (detail.order.totalCents as number)
          : 0) / 100
      ).toFixed(2),
      fecha_estimada: detail.order.estimatedCompletionAt?.toISOString() ?? "",
      horario: "",
      url: `${baseUrl}/taller/${token}`,
    });
    await this.db.insert(workshopNotifications).values({
      workshopOrderId: orderId,
      channel: "whatsapp",
      recipient: (customer?.phone ?? "").replace(/.(?=.{4})/g, "*"),
      messagePreview: "Mensaje de seguimiento abierto",
      status: "opened",
      createdBy: admin,
    });
    return { url, publicToken: token, status: "opened" };
  }
}
