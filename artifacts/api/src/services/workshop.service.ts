import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  administrators,
  agreements,
  auditLogs,
  customerBicycles,
  customerTeamAffiliations,
  customerLoyaltyBalance,
  customers,
  rateLimits,
  teams,
  workshopCustomerUpdates,
  workshopFinancialMovements,
  workshopNotifications,
  workshopOrderParts,
  workshopOrderAgreementApplications,
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
import { buildWhatsappMessage, buildWhatsappUrl, type PublicLinksService } from "./public-links.service.js";
type Db = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type QueryDb = Db | Tx;
type Bicycle = z.infer<typeof bicycleSchema>;
type RequestInput = z.infer<typeof workshopRequestSchema>;
type OrderInput = z.infer<typeof workshopOrderSchema>;
type Line = z.infer<typeof workshopServiceSchema>;
type CatalogService = z.infer<typeof workshopServiceCatalogSchema>;
type Part = z.infer<typeof workshopPartSchema>;
type Update = z.infer<typeof workshopUpdateSchema>;
type Status = z.infer<typeof workshopStatusSchema>;
type FinanceAudit = { requestId: string; ipAddress: string | undefined; userAgent: string | undefined };
type MovementInput = {
  type: "advance" | "payment" | "discount" | "credit_applied" | "charge" | "refund";
  amountCents: number;
  paymentMethod?: "cash" | "card" | "transfer" | "customer_credit" | "agreement" | "other" | null | undefined;
  reference?: string | null | undefined;
  note?: string | null | undefined;
  occurredDate: string;
};
type FinancialMovement = typeof workshopFinancialMovements.$inferSelect;
function aggregateMovements(movements: FinancialMovement[]) {
  const byId = new Map(movements.map((movement) => [movement.id, movement]));
  const bucket = (movement: FinancialMovement): string => {
    if (movement.type !== "correction" || !movement.correctedMovementId)
      return movement.type;
    const original = byId.get(movement.correctedMovementId);
    return original ? bucket(original) : "correction";
  };
  let discountCents = 0,
    amountPaidCents = 0,
    chargeCents = 0,
    creditAppliedCents = 0;
  for (const movement of movements) {
    const kind = bucket(movement);
    if (kind === "discount") discountCents += movement.amountCents;
    else if (kind === "charge") chargeCents += movement.amountCents;
    else if (["advance", "payment", "credit_applied", "refund"].includes(kind))
      amountPaidCents += movement.amountCents;
    if (kind === "credit_applied") creditAppliedCents += movement.amountCents;
  }
  return {
    discountCents: Math.max(0, discountCents),
    amountPaidCents: Math.max(0, amountPaidCents),
    chargeCents,
    creditAppliedCents: Math.max(0, creditAppliedCents),
  };
}
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
const num = (prefix: string) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export class WorkshopService {
  constructor(private db: Db, private publicLinks?: PublicLinksService) {}
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
    await this.validateRequestAvailability(input.requestedDate, input.requestedTime);
    if (input.catalogServiceId) {
      const [service] = await this.db.select({ id: workshopServiceCatalog.id, name: workshopServiceCatalog.name })
        .from(workshopServiceCatalog).where(and(eq(workshopServiceCatalog.id, input.catalogServiceId), eq(workshopServiceCatalog.isActive, true), eq(workshopServiceCatalog.isCustomerVisible, true), isNull(workshopServiceCatalog.deletedAt))).limit(1);
      if (!service || (input.serviceName && input.serviceName !== service.name)) throw new Error("Servicio no disponible");
      input = { ...input, serviceName: service.name };
    }
    const row = await this.db.transaction(async (tx) => {
      if (input.requestedDate) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`workshop-capacity:${input.requestedDate}`}, 0))`);
        const [settings] = await tx.select().from(workshopSettings).limit(1);
        const [used] = await tx.select({ count: sql<number>`count(*)::int` }).from(workshopRequests).where(and(eq(workshopRequests.requestedDate, input.requestedDate), sql`${workshopRequests.status} NOT IN ('rejected','cancelled')`));
        if (settings?.dailyCapacity && (used?.count ?? 0) >= settings.dailyCapacity) throw new Error("El día ya no tiene disponibilidad");
      }
      const [created] = await tx.insert(workshopRequests).values({ ...input, requestNumber: num("SOL"), status: "pending" }).returning();
      return created;
    });
    if (!row) return null;
    const link = this.publicLinks
      ? await this.publicLinks.getOrCreateActiveLink("workshop_request", { workshopRequestId: row.id })
      : null;
    return { ...row, publicUrl: link?.url ?? null };
  }
  async publicCatalog() {
    return this.db.select({
      id: workshopServiceCatalog.id,
      name: workshopServiceCatalog.name,
      description: workshopServiceCatalog.description,
    }).from(workshopServiceCatalog).where(and(eq(workshopServiceCatalog.isActive, true), eq(workshopServiceCatalog.isCustomerVisible, true), isNull(workshopServiceCatalog.deletedAt)))
      .orderBy(asc(workshopServiceCatalog.sortOrder), asc(workshopServiceCatalog.name));
  }
  async availability() {
    const settings = await this.getSettings();
    if (!settings?.dailyCapacity || !Object.keys(settings.schedule ?? {}).length) return { configured: false, timezone: "America/Mexico_City", days: [] };
    const start = new Date();
    const end = new Date(start.getTime() + settings.bookingHorizonDays * 86400000);
    const rows = await this.db.select({ date: workshopRequests.requestedDate, count: sql<number>`count(*)::int` }).from(workshopRequests)
      .where(and(sql`${workshopRequests.requestedDate} IS NOT NULL`, sql`${workshopRequests.requestedDate} BETWEEN ${start.toISOString().slice(0, 10)} AND ${end.toISOString().slice(0, 10)}`, sql`${workshopRequests.status} NOT IN ('rejected','cancelled')`))
      .groupBy(workshopRequests.requestedDate);
    const counts = new Map(rows.map((row) => [row.date, row.count]));
    const days = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: settings.scheduleTimezone, weekday: "short" }).format(cursor).toLowerCase().slice(0, 3);
      const times = (settings.schedule?.[weekday] ?? []).filter((time) => new Date(`${date}T${time}:00-06:00`).getTime() >= Date.now() + settings.minimumNoticeMinutes * 60000);
      if (times.length) days.push({ date, times, available: (counts.get(date) ?? 0) < settings.dailyCapacity });
    }
    return { configured: true, timezone: settings.scheduleTimezone, days };
  }
  private async validateRequestAvailability(date?: string | null, time?: string | null) {
    if (!date && !time) return;
    if (!date || !time) throw new Error("Selecciona fecha y horario");
    const available = await this.availability();
    if (!available.configured) throw new Error("La agenda no está configurada");
    const day = available.days.find((item) => item.date === date);
    if (!day?.available || !day.times.includes(time)) throw new Error("El horario ya no está disponible");
    const requested = new Date(`${date}T${time}:00-06:00`).getTime();
    const settings = await this.getSettings();
    if (requested < Date.now() + (settings?.minimumNoticeMinutes ?? 120) * 60000) throw new Error("La fecha solicitada requiere mayor anticipación");
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
  async publicRequest(id: string) {
    const request = await this.getRequest(id);
    if (!request) return null;
    const order = request.convertedOrderId ? await this.publicOrderById(request.convertedOrderId) : null;
    const maskPhone = request.customerPhone.replace(/\d(?=\d{4})/g, "*");
    const maskEmail = request.customerEmail?.replace(/^(.).+(@.+)$/, "$1***$2") ?? null;
    return {
      requestNumber: request.requestNumber,
      status: request.status,
      customerName: request.customerName.split(" ")[0],
      customerPhone: maskPhone,
      customerEmail: maskEmail,
      bicycle: { brand: request.bikeBrand, model: request.bikeModel, type: request.bikeType, color: request.bikeColor },
      serviceName: request.serviceName,
      problemDescription: request.problemDescription,
      requestedDate: request.requestedDate,
      requestedTime: request.requestedTime,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      order,
    };
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
    await this.validateRequestAvailability(input.requestedDate, input.requestedTime);
    return this.db.transaction(async (tx) => {
      if (input.requestedDate) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`workshop-capacity:${input.requestedDate}`}, 0))`);
        const [settings] = await tx.select().from(workshopSettings).limit(1);
        const [used] = await tx.select({ count: sql<number>`count(*)::int` }).from(workshopRequests).where(and(eq(workshopRequests.requestedDate, input.requestedDate), sql`${workshopRequests.status} NOT IN ('rejected','cancelled')`));
        if (settings?.dailyCapacity && (used?.count ?? 0) >= settings.dailyCapacity) throw new Error("El día ya no tiene disponibilidad");
      }
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
      let serviceName = input.serviceName;
      if (input.catalogServiceId) {
        const [service] = await tx.select({ name: workshopServiceCatalog.name }).from(workshopServiceCatalog)
          .where(and(eq(workshopServiceCatalog.id, input.catalogServiceId), eq(workshopServiceCatalog.isActive, true), eq(workshopServiceCatalog.isCustomerVisible, true), isNull(workshopServiceCatalog.deletedAt))).limit(1);
        if (!service) return null;
        serviceName = service.name;
      }
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
        bikeColor: bike.color,
        bikeWheelSize: bike.wheelSize,
        bikeYear: bike.year,
        bikeBrakeType: bike.brakeType,
        bikeSuspensionType: bike.suspensionType,
        bikeDrivetrain: bike.drivetrain,
        bikeGeneralCondition: bike.generalCondition,
        bikeSerialNumber: bike.serialNumber,
        bikeFrameNumber: bike.frameNumber,
        bikeNotes: bike.notes,
        catalogServiceId: input.catalogServiceId,
        serviceName,
        problemDescription: input.problemDescription,
        symptoms: input.symptoms,
        visibleDamage: input.visibleDamage,
        additionalComments: input.additionalComments,
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime,
        desiredDeliveryDate: input.desiredDeliveryDate,
        urgency: input.urgency,
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
    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(workshopRequests)
        .where(eq(workshopRequests.id, id))
        .limit(1)
        .for("update");
      if (!request || ["converted", "rejected", "cancelled"].includes(request.status))
        throw new Error("Solicitud no disponible");
      let customerId = ids.customerId ?? request.customerId ?? undefined;
      if (!customerId) {
        const matches = await tx.select({ id: customers.id }).from(customers).where(and(
          or(eq(customers.phone, request.customerPhone), request.customerEmail ? eq(customers.email, request.customerEmail) : undefined),
          isNull(customers.deletedAt),
        )).limit(2);
        if (matches.length === 1) customerId = matches[0]!.id;
        else if (matches.length > 1) throw new Error("Selecciona el cliente correcto antes de convertir");
      }
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
        await tx.insert(customerLoyaltyBalance).values({ customerId });
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
            color: request.bikeColor,
            wheelSize: request.bikeWheelSize,
            year: request.bikeYear,
            brakeType: request.bikeBrakeType,
            suspensionType: request.bikeSuspensionType,
            drivetrain: request.bikeDrivetrain,
            generalCondition: request.bikeGeneralCondition,
            serialNumber: request.bikeSerialNumber,
            frameNumber: request.bikeFrameNumber,
            notes: [request.bikeNotes, request.bikeAccessories && `Accesorios: ${request.bikeAccessories}`].filter(Boolean).join("\n") || null,
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
      if (request.catalogServiceId || request.serviceName) {
        await tx.insert(workshopOrderServices).values({
          workshopOrderId: order.id,
          catalogServiceId: request.catalogServiceId,
          serviceName: request.serviceName || "Diagnóstico",
          description: request.problemDescription,
          quantity: 1,
          unitPriceCents: 0,
          totalCents: 0,
          status: "pending",
          isCustomerVisible: true,
        });
      }
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
      return { order };
    }).then(async (result) => {
      const link = this.publicLinks
        ? await this.publicLinks.getOrCreateActiveLink("workshop_tracking", { workshopOrderId: result.order.id })
        : null;
      return { ...result, publicToken: link?.code ?? "", publicUrl: link?.url ?? null };
    });
  }
  async createOrder(input: OrderInput, admin: string) {
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
      await tx.insert(workshopStatusHistory).values({
        workshopOrderId: order.id,
        newStatus: "received",
        changedBy: admin,
        publicMessage: null,
      });
      return { order };
    }).then(async (result) => {
      const link = this.publicLinks
        ? await this.publicLinks.getOrCreateActiveLink("workshop_tracking", { workshopOrderId: result.order.id })
        : null;
      return { ...result, publicToken: link?.code ?? "", publicUrl: link?.url ?? null };
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
      if (input.status === "delivered") {
        const summary = await this.financialSummary(id, tx);
        if (!summary || summary.pendingCents > 0)
          throw new Error("No se puede entregar una orden con saldo pendiente");
      }
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
  async recalc(orderId: string, tx: QueryDb = this.db) {
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
    const lineTotals = calculateWorkshopTotals(
      services,
      parts,
      0,
    );
    const movements = await tx.select().from(workshopFinancialMovements)
      .where(eq(workshopFinancialMovements.workshopOrderId, orderId));
    const { discountCents, amountPaidCents, chargeCents } =
      aggregateMovements(movements);
    const totalCents = Math.max(0, lineTotals.subtotalServicesCents + lineTotals.subtotalPartsCents + chargeCents - discountCents);
    const pendingCents = Math.max(0, totalCents - amountPaidCents);
    const favorCents = Math.max(0, amountPaidCents - totalCents);
    const paymentStatus = pendingCents === 0 ? (favorCents > 0 ? "favor" : "paid") : amountPaidCents > 0 ? "partial" : "pending";
    const totals = { ...lineTotals, discountCents, totalCents, amountPaidCents, paymentStatus };
    await tx
      .update(workshopOrders)
      .set({ ...totals, updatedAt: new Date() })
      .where(eq(workshopOrders.id, orderId));
    return totals;
  }
  async financialSummary(orderId: string, tx: QueryDb = this.db) {
    await this.recalc(orderId, tx);
    const [[order], movements] = await Promise.all([
      tx.select({
        totalCents: workshopOrders.totalCents,
        paidCents: workshopOrders.amountPaidCents,
        discountCents: workshopOrders.discountCents,
        paymentStatus: workshopOrders.paymentStatus,
      }).from(workshopOrders).where(eq(workshopOrders.id, orderId)).limit(1),
      tx.select().from(workshopFinancialMovements)
        .where(eq(workshopFinancialMovements.workshopOrderId, orderId)),
    ]);
    return order ? {
      ...order,
      creditAppliedCents: aggregateMovements(movements).creditAppliedCents,
      pendingCents: Math.max(0, order.totalCents - order.paidCents),
      favorCents: Math.max(0, order.paidCents - order.totalCents),
    } : null;
  }
  private async atomicFinanceAudit(tx: QueryDb, audit: FinanceAudit, admin: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await tx.insert(auditLogs).values({ requestId: audit.requestId, administratorId: admin, action, success: true, entityType: "workshop_financial_movement", entityId, ipAddress: audit.ipAddress, userAgent: audit.userAgent, metadata });
  }
  async listFinancialMovements(orderId: string) {
    const summary = await this.financialSummary(orderId);
    const movements = await this.db.select().from(workshopFinancialMovements).where(eq(workshopFinancialMovements.workshopOrderId, orderId)).orderBy(asc(workshopFinancialMovements.occurredDate), asc(workshopFinancialMovements.createdAt));
    return { summary, movements };
  }
  listTeams(includeInactive = false) {
    return this.db.select().from(teams).where(includeInactive ? undefined : eq(teams.active, true)).orderBy(asc(teams.name));
  }
  async createTeam(input: { name: string; active: boolean }, admin: string) {
    const [row] = await this.db.insert(teams).values({ ...input, createdBy: admin, updatedBy: admin }).returning();
    return row;
  }
  async updateTeam(id: string, input: { name?: string | undefined; active?: boolean | undefined }, admin: string) {
    const [row] = await this.db.update(teams).set({ ...input, updatedAt: new Date(), updatedBy: admin }).where(eq(teams.id, id)).returning();
    return row ?? null;
  }
  listAgreements(includeInactive = false) {
    return this.db.select({ agreement: agreements, team: teams }).from(agreements).innerJoin(teams, eq(agreements.teamId, teams.id)).where(includeInactive ? undefined : eq(agreements.active, true)).orderBy(asc(teams.name), desc(agreements.validFrom));
  }
  async createAgreement(input: typeof agreements.$inferInsert, admin: string) {
    const [row] = await this.db.insert(agreements).values({ ...input, createdBy: admin, updatedBy: admin }).returning();
    return row;
  }
  async updateAgreement(id: string, input: Record<string, unknown>, admin: string) {
    const [row] = await this.db.update(agreements).set({ ...input, updatedAt: new Date(), updatedBy: admin }).where(eq(agreements.id, id)).returning();
    return row ?? null;
  }
  listAffiliations(status?: string) {
    return this.db.select({ affiliation: customerTeamAffiliations, team: teams, customer: { id: customers.id, firstName: customers.firstName, lastName: customers.lastName } }).from(customerTeamAffiliations).leftJoin(teams, eq(customerTeamAffiliations.teamId, teams.id)).innerJoin(customers, eq(customerTeamAffiliations.customerId, customers.id)).where(status ? eq(customerTeamAffiliations.status, status) : undefined).orderBy(desc(customerTeamAffiliations.createdAt));
  }
  async requestAffiliation(customerId: string, input: { teamId?: string | undefined; proposedTeamName?: string | undefined }) {
    if (input.teamId) {
      const [team] = await this.db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.active, true))).limit(1);
      if (!team) throw new Error("Equipo no disponible");
    }
    const [row] = await this.db.insert(customerTeamAffiliations).values({ customerId, teamId: input.teamId, proposedTeamName: input.proposedTeamName, status: "pending" }).returning();
    return row;
  }
  async getCustomerAffiliation(customerId: string) {
    const [row] = await this.db.select({ affiliation: customerTeamAffiliations, team: teams }).from(customerTeamAffiliations).leftJoin(teams, eq(customerTeamAffiliations.teamId, teams.id)).where(and(eq(customerTeamAffiliations.customerId, customerId), or(eq(customerTeamAffiliations.status, "pending"), eq(customerTeamAffiliations.status, "verified")))).limit(1);
    return row ?? null;
  }
  async reviewAffiliation(id: string, status: "verified" | "rejected" | "expired", evidenceNote: string, admin: string) {
    const [row] = await this.db.update(customerTeamAffiliations).set({ status, evidenceNote, verifiedBy: admin, verificationDate: new Date(), updatedAt: new Date() }).where(eq(customerTeamAffiliations.id, id)).returning();
    return row ?? null;
  }
  async applyAgreement(orderId: string, agreementId: string, occurredDate: string, admin: string, audit: FinanceAudit) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(workshopOrders).where(eq(workshopOrders.id, orderId)).limit(1).for("update");
      if (!order) throw new Error("Orden no encontrada");
      const [match] = await tx.select({ agreement: agreements, team: teams }).from(agreements).innerJoin(teams, eq(agreements.teamId, teams.id)).innerJoin(customerTeamAffiliations, and(eq(customerTeamAffiliations.teamId, agreements.teamId), eq(customerTeamAffiliations.customerId, order.customerId), eq(customerTeamAffiliations.status, "verified"))).where(and(eq(agreements.id, agreementId), eq(agreements.active, true), eq(teams.active, true), sql`${agreements.validFrom}<=${occurredDate}`, or(isNull(agreements.validUntil), sql`${agreements.validUntil}>=${occurredDate}`))).limit(1);
      if (!match) throw new Error("Convenio no válido para el cliente y fecha");
      const existingManual = await tx.select({ id: workshopFinancialMovements.id }).from(workshopFinancialMovements).where(and(eq(workshopFinancialMovements.workshopOrderId, orderId), eq(workshopFinancialMovements.type, "discount"), isNull(workshopFinancialMovements.agreementApplicationId))).limit(1);
      if (existingManual.length && !match.agreement.combinable)
        throw new Error("El convenio no permite combinar descuento manual");
      const lineTotal = (await this.recalc(orderId, tx))?.totalCents ?? 0;
      const discountCents = match.agreement.discountType === "percentage" ? Math.floor(lineTotal * match.agreement.value / 10000) : Math.min(lineTotal, match.agreement.value);
      if (discountCents <= 0) throw new Error("El convenio no genera descuento para esta orden");
      const [application] = await tx.insert(workshopOrderAgreementApplications).values({ workshopOrderId: orderId, agreementId, teamId: match.team.id, teamName: match.team.name, discountType: match.agreement.discountType, agreementValue: match.agreement.value, discountCents, conditions: match.agreement.conditions, combinable: match.agreement.combinable, appliedBy: admin }).returning();
      if (!application) throw new Error("No se pudo aplicar el convenio");
      const [movement] = await tx.insert(workshopFinancialMovements).values({ workshopOrderId: orderId, customerId: order.customerId, type: "discount", amountCents: discountCents, paymentMethod: "agreement", note: `Convenio ${match.team.name}`, occurredDate, responsibleAdminId: admin, agreementApplicationId: application.id }).returning();
      if (!movement) throw new Error("No se pudo registrar el descuento");
      await this.recalc(orderId, tx);
      await this.atomicFinanceAudit(tx, audit, admin, "workshop.agreement.apply", movement.id, { orderId, agreementId, discountCents });
      return { application, movement };
    });
  }
  async customerFinancials(customerId: string, orderNumber?: string) {
    const filters = [eq(workshopOrders.customerId, customerId)];
    if (orderNumber) filters.push(eq(workshopOrders.orderNumber, orderNumber));
    const rows = await this.db.select({ movement: workshopFinancialMovements, orderNumber: workshopOrders.orderNumber }).from(workshopFinancialMovements).innerJoin(workshopOrders, eq(workshopFinancialMovements.workshopOrderId, workshopOrders.id)).where(and(...filters)).orderBy(desc(workshopFinancialMovements.occurredDate), desc(workshopFinancialMovements.createdAt));
    const movements = rows.map(({ movement, orderNumber: number }) => ({ id: movement.id, orderNumber: number, type: movement.type, amountCents: movement.amountCents, paymentMethod: movement.paymentMethod, reference: movement.reference ? `***${movement.reference.slice(-4)}` : null, occurredDate: movement.occurredDate, correctedMovementId: movement.correctedMovementId, createdAt: movement.createdAt }));
    const orders = await this.db.select({ id: workshopOrders.id, orderNumber: workshopOrders.orderNumber }).from(workshopOrders).where(and(...filters));
    const summaries = await Promise.all(orders.map(async (order) => ({ orderNumber: order.orderNumber, ...(await this.financialSummary(order.id)) })));
    return { summaries, movements };
  }
  async createFinancialMovement(orderId: string, input: MovementInput, admin: string, audit: FinanceAudit, dedicated = false) {
    return this.db.transaction(async (tx) => {
      if (!dedicated && (["credit_applied", "refund"].includes(input.type) || ["customer_credit", "agreement"].includes(input.paymentMethod ?? "")))
        throw new Error("Este movimiento requiere su flujo dedicado");
      const [order] = await tx.select().from(workshopOrders).where(eq(workshopOrders.id, orderId)).limit(1).for("update");
      if (!order) throw new Error("Orden no encontrada");
      if (input.type === "discount") {
        const [application] = await tx.select({ combinable: workshopOrderAgreementApplications.combinable }).from(workshopOrderAgreementApplications).where(eq(workshopOrderAgreementApplications.workshopOrderId, orderId)).limit(1);
        if (application && !application.combinable) throw new Error("El convenio aplicado no permite descuento manual");
      }
      const [movement] = await tx.insert(workshopFinancialMovements).values({ ...input, workshopOrderId: orderId, customerId: order.customerId, responsibleAdminId: admin }).returning();
      if (!movement) throw new Error("No se pudo registrar el movimiento");
      await this.recalc(orderId, tx);
      await this.atomicFinanceAudit(tx, audit, admin, "workshop.finance.create", movement.id, { orderId, type: input.type, amountCents: input.amountCents });
      return movement;
    });
  }
  async reverseFinancialMovement(movementId: string, reason: string, admin: string, audit: FinanceAudit) {
    return this.db.transaction(async (tx) => {
      const [original] = await tx.select().from(workshopFinancialMovements).where(eq(workshopFinancialMovements.id, movementId)).limit(1).for("update");
      if (!original) throw new Error("Movimiento no encontrado");
      const [movement] = await tx.insert(workshopFinancialMovements).values({ workshopOrderId: original.workshopOrderId, customerId: original.customerId, type: "correction", amountCents: -original.amountCents, paymentMethod: original.paymentMethod, note: reason, occurredDate: new Date().toISOString().slice(0, 10), responsibleAdminId: admin, correctedMovementId: original.id }).returning();
      if (!movement) throw new Error("No se pudo revertir el movimiento");
      await this.recalc(original.workshopOrderId, tx);
      await this.atomicFinanceAudit(tx, audit, admin, "workshop.finance.reverse", movement.id, { correctedMovementId: original.id, reason });
      return movement;
    });
  }
  async applyFavor(sourceOrderId: string, targetOrderId: string, amountCents: number, occurredDate: string, note: string | null | undefined, admin: string, audit: FinanceAudit) {
    if (sourceOrderId === targetOrderId) throw new Error("Selecciona otra orden");
    return this.db.transaction(async (tx) => {
      const orders = await tx.select().from(workshopOrders).where(or(eq(workshopOrders.id, sourceOrderId), eq(workshopOrders.id, targetOrderId))).orderBy(asc(workshopOrders.id)).for("update");
      const source = orders.find((x) => x.id === sourceOrderId), target = orders.find((x) => x.id === targetOrderId);
      if (!source || !target || source.customerId !== target.customerId) throw new Error("El favor no puede transferirse entre clientes");
      const sourceSummary = await this.financialSummary(sourceOrderId, tx);
      if (!sourceSummary || sourceSummary.favorCents < amountCents) throw new Error("Favor insuficiente");
      const [out] = await tx.insert(workshopFinancialMovements).values({ workshopOrderId: source.id, customerId: source.customerId, type: "refund", amountCents: -amountCents, paymentMethod: "customer_credit", note: note || `Aplicado a ${target.orderNumber}`, occurredDate, responsibleAdminId: admin }).returning();
      const [incoming] = await tx.insert(workshopFinancialMovements).values({ workshopOrderId: target.id, customerId: target.customerId, type: "credit_applied", amountCents, paymentMethod: "customer_credit", note: note || `Favor de ${source.orderNumber}`, occurredDate, responsibleAdminId: admin }).returning();
      if (!out || !incoming) throw new Error("No se pudo aplicar el favor");
      await this.recalc(source.id, tx); await this.recalc(target.id, tx);
      await this.atomicFinanceAudit(tx, audit, admin, "workshop.finance.apply_favor", incoming.id, { sourceOrderId, targetOrderId, amountCents });
      return { sourceMovement: out, targetMovement: incoming };
    });
  }
  async refundFavor(orderId: string, input: { amountCents: number; paymentMethod: MovementInput["paymentMethod"]; reference?: string | null; reason: string; occurredDate: string }, admin: string, audit: FinanceAudit) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(workshopOrders).where(eq(workshopOrders.id, orderId)).limit(1).for("update");
      if (!order) throw new Error("Orden no encontrada");
      const summary = await this.financialSummary(orderId, tx);
      if (!summary || summary.favorCents < input.amountCents) throw new Error("Favor insuficiente");
      const [movement] = await tx.insert(workshopFinancialMovements).values({ workshopOrderId: orderId, customerId: order.customerId, type: "refund", amountCents: -input.amountCents, paymentMethod: input.paymentMethod, reference: input.reference, note: input.reason, occurredDate: input.occurredDate, responsibleAdminId: admin }).returning();
      if (!movement) throw new Error("No se pudo registrar el reembolso");
      await this.recalc(orderId, tx);
      await this.atomicFinanceAudit(tx, audit, admin, "workshop.finance.refund_favor", movement.id, { orderId, amountCents: input.amountCents, reason: input.reason });
      return movement;
    });
  }
  async addService(orderId: string, input: Line) {
    return this.db.transaction(async (tx) => { const [row] = await tx
      .insert(workshopOrderServices)
      .values({
        ...input,
        workshopOrderId: orderId,
        totalCents: input.quantity * input.unitPriceCents,
      })
      .returning();
    await this.recalc(orderId, tx);
    return row; });
  }
  async updateService(id: string, input: Partial<Line>) {
    return this.db.transaction(async (tx) => { const current = (
      await tx
        .select()
        .from(workshopOrderServices)
        .where(eq(workshopOrderServices.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    const quantity = input.quantity ?? current.quantity,
      price = input.unitPriceCents ?? current.unitPriceCents,
      [row] = await tx
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
    await this.recalc(current.workshopOrderId, tx);
    return row; });
  }
  async deleteService(id: string) {
    return this.db.transaction(async (tx) => { const [row] = await tx
      .delete(workshopOrderServices)
      .where(eq(workshopOrderServices.id, id))
      .returning();
    if (row) await this.recalc(row.workshopOrderId, tx);
    return !!row; });
  }
  async addPart(orderId: string, input: Part) {
    return this.db.transaction(async (tx) => { const [row] = await tx
      .insert(workshopOrderParts)
      .values({
        ...input,
        workshopOrderId: orderId,
        totalCents: input.quantity * input.unitPriceCents,
      })
      .returning();
    await this.recalc(orderId, tx);
    return row; });
  }
  async updatePart(id: string, input: Partial<Part>) {
    return this.db.transaction(async (tx) => { const current = (
      await tx
        .select()
        .from(workshopOrderParts)
        .where(eq(workshopOrderParts.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    const quantity = input.quantity ?? current.quantity,
      price = input.unitPriceCents ?? current.unitPriceCents,
      [row] = await tx
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
    await this.recalc(current.workshopOrderId, tx);
    return row; });
  }
  async deletePart(id: string) {
    return this.db.transaction(async (tx) => { const [row] = await tx
      .delete(workshopOrderParts)
      .where(eq(workshopOrderParts.id, id))
      .returning();
    if (row) await this.recalc(row.workshopOrderId, tx);
    return !!row; });
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
    if (this.publicLinks) return (await this.publicLinks.regenerateLink("workshop_tracking", { workshopOrderId: orderId })).code;
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
  async getOrCreateActiveLink(orderId: string) {
    if (!this.publicLinks) return this.regenerateToken(orderId);
    return (await this.publicLinks.getOrCreateActiveLink("workshop_tracking", { workshopOrderId: orderId })).code;
  }
  async publicOrderById(orderId: string) {
    const [settings] = await this.db.select().from(workshopSettings).limit(1);
    if (settings && !settings.publicTrackingEnabled) return null;
    const [match] = await this.db.select({ order: workshopOrders, bike: customerBicycles }).from(workshopOrders)
      .innerJoin(customerBicycles, eq(workshopOrders.bicycleId, customerBicycles.id))
      .where(eq(workshopOrders.id, orderId)).limit(1);
    return match ? this.customerOrderProjection(match.order, match.bike, settings?.publicStatusLabels ?? {}) : null;
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
      token = await this.getOrCreateActiveLink(orderId),
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
    const publicUrl = this.publicLinks?.buildUrl(token) ?? `${baseUrl}/taller/${token}`;
    const message = buildWhatsappMessage(template, {
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
      url: publicUrl,
    });
    const url = buildWhatsappUrl(customer?.phone ?? "", message);
    await this.db.insert(workshopNotifications).values({
      workshopOrderId: orderId,
      channel: "whatsapp",
      recipient: (customer?.phone ?? "").replace(/.(?=.{4})/g, "*"),
      messagePreview: "Mensaje de seguimiento abierto",
      status: "opened",
      createdBy: admin,
    });
    return { url, publicToken: token, publicUrl, status: "opened" };
  }
}
