import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  catalogRequests,
  customerLoyaltyMovements,
  customers,
  eventProducts,
  events,
  products,
  workshopCustomerUpdates,
  workshopOrders,
  workshopRequests,
  type createDatabase,
} from "@mi-bicla/db";
import type {
  CatalogRequestCreateInput,
  CatalogRequestPatchInput,
  EventCreateInput,
  EventUpdateInput,
  ProductCreateInput,
  ProductUpdateInput,
} from "@mi-bicla/api-contract";

type Database = ReturnType<typeof createDatabase>["db"];
type CommerceStorage = { uploadDir: string };

export function localCommerceUploadPath(
  imageUrl: string | null,
  storage: CommerceStorage,
) {
  if (!imageUrl) return null;
  try {
    const image = new URL(imageUrl);
    const match = image.pathname.match(
      /^\/api\/uploads\/([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|webp))$/i,
    );
    return match?.[1] ? path.join(storage.uploadDir, match[1]) : null;
  } catch {
    return null;
  }
}

export class CommerceService {
  constructor(
    private readonly db: Database,
    private readonly storage?: CommerceStorage,
  ) {}

  private eventIsCurrent() {
    return sql`COALESCE(${events.endsAt}, ${events.startsAt} + interval '24 hours') > now()`;
  }

  private async removeUnusedImages(imageUrls: Array<string | null>) {
    if (!this.storage) return;
    const candidates = [...new Set(imageUrls.filter((url): url is string => !!url))];
    if (!candidates.length) return;
    const [eventReferences, productReferences] = await Promise.all([
      this.db
        .select({ imageUrl: events.imageUrl })
        .from(events)
        .where(inArray(events.imageUrl, candidates)),
      this.db
        .select({ imageUrl: products.imageUrl })
        .from(products)
        .where(inArray(products.imageUrl, candidates)),
    ]);
    const used = new Set(
      [...eventReferences, ...productReferences]
        .map(({ imageUrl }) => imageUrl)
        .filter((url): url is string => !!url),
    );
    for (const imageUrl of candidates) {
      if (used.has(imageUrl)) continue;
      const file = localCommerceUploadPath(imageUrl, this.storage);
      if (!file) continue;
      try {
        await unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }

  async deleteExpiredEvents() {
    const expired = await this.db
      .delete(events)
      .where(
        sql`COALESCE(${events.endsAt}, ${events.startsAt} + interval '24 hours') <= now()`,
      )
      .returning({ id: events.id, imageUrl: events.imageUrl });
    await this.removeUnusedImages(expired.map(({ imageUrl }) => imageUrl));
    return expired.length;
  }

  async deleteEvent(id: string) {
    const [deleted] = await this.db
      .delete(events)
      .where(eq(events.id, id))
      .returning({ id: events.id, imageUrl: events.imageUrl });
    if (!deleted) return false;
    await this.removeUnusedImages([deleted.imageUrl]);
    return true;
  }

  async listPublicProducts(query: { search: string; category: string }) {
    const filters = [eq(products.isPublished, true)];
    if (query.search)
      filters.push(
        or(
          ilike(products.name, `%${query.search}%`),
          ilike(products.description, `%${query.search}%`),
        )!,
      );
    if (query.category) filters.push(eq(products.category, query.category));
    return this.db
      .select()
      .from(products)
      .where(and(...filters))
      .orderBy(asc(products.category), asc(products.name));
  }

  async listProducts() {
    return this.db.select().from(products).orderBy(desc(products.updatedAt));
  }

  async createProduct(input: ProductCreateInput) {
    const [result] = await this.db.insert(products).values(input).returning();
    return result!;
  }

  async updateProduct(id: string, input: ProductUpdateInput) {
    const [result] = await this.db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result ?? null;
  }

  private async eventsWithProducts(publicOnly: boolean, category = "") {
    await this.deleteExpiredEvents();
    const eventRows = await this.db
      .select()
      .from(events)
      .where(
        publicOnly
          ? and(
              eq(events.isPublished, true),
              this.eventIsCurrent(),
              category ? eq(events.category, category) : undefined,
            )
          : undefined,
      )
      .orderBy(publicOnly ? asc(events.startsAt) : desc(events.startsAt));
    if (!eventRows.length) return [];
    const associations = await this.db
      .select({ eventId: eventProducts.eventId, product: products })
      .from(eventProducts)
      .innerJoin(products, eq(eventProducts.productId, products.id))
      .where(
        and(
          inArray(
            eventProducts.eventId,
            eventRows.map((event) => event.id),
          ),
          publicOnly ? eq(products.isPublished, true) : undefined,
        ),
      )
      .orderBy(asc(products.name));
    return eventRows.map((event) => ({
      ...event,
      products: associations
        .filter((association) => association.eventId === event.id)
        .map((association) => association.product),
    }));
  }

  listPublicEvents(category = "") {
    return this.eventsWithProducts(true, category);
  }

  listEvents() {
    return this.eventsWithProducts(false);
  }

  async createEvent(input: EventCreateInput) {
    const [result] = await this.db
      .insert(events)
      .values({
        ...input,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      })
      .returning();
    return { ...result!, products: [] };
  }

  async updateEvent(id: string, input: EventUpdateInput) {
    const [current] = await this.db
      .select()
      .from(events)
      .where(eq(events.id, id));
    if (!current) return null;
    const startsAt = input.startsAt
      ? new Date(input.startsAt)
      : current.startsAt;
    const endsAt =
      input.endsAt === undefined
        ? current.endsAt
        : input.endsAt === null
          ? null
          : new Date(input.endsAt);
    if (endsAt && endsAt <= startsAt) return false;
    const [result] = await this.db
      .update(events)
      .set({
        ...input,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt:
          input.endsAt === null
            ? null
            : input.endsAt
              ? new Date(input.endsAt)
              : undefined,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();
    if (!result) return null;
    if (input.imageUrl !== undefined && input.imageUrl !== current.imageUrl)
      await this.removeUnusedImages([current.imageUrl]);
    const linked = await this.db
      .select({ product: products })
      .from(eventProducts)
      .innerJoin(products, eq(eventProducts.productId, products.id))
      .where(eq(eventProducts.eventId, id));
    return { ...result, products: linked.map((row) => row.product) };
  }

  async replaceEventProducts(eventId: string, productIds: string[]) {
    return this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, eventId));
      if (!event) return null;
      if (productIds.length) {
        const existing = await tx
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.id, productIds));
        if (existing.length !== productIds.length) return false;
      }
      await tx.delete(eventProducts).where(eq(eventProducts.eventId, eventId));
      if (productIds.length)
        await tx
          .insert(eventProducts)
          .values(productIds.map((productId) => ({ eventId, productId })));
      return productIds;
    });
  }

  private requestSelection(includeCustomerPhone: boolean) {
    return {
      request: catalogRequests,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      ...(includeCustomerPhone ? { customerPhone: customers.phone } : {}),
      productName: products.name,
      eventTitle: events.title,
    };
  }

  private requestRows(where?: SQL, includeCustomerPhone = false) {
    return this.db
      .select(this.requestSelection(includeCustomerPhone))
      .from(catalogRequests)
      .innerJoin(customers, eq(catalogRequests.customerId, customers.id))
      .leftJoin(products, eq(catalogRequests.productId, products.id))
      .leftJoin(events, eq(catalogRequests.eventId, events.id))
      .where(where)
      .orderBy(desc(catalogRequests.createdAt));
  }

  listCustomerRequests(customerId: string) {
    return this.requestRows(eq(catalogRequests.customerId, customerId));
  }

  listRequests() {
    return this.requestRows(undefined, true);
  }

  async createRequest(customerId: string, input: CatalogRequestCreateInput) {
    if (input.productId) {
      const [product] = await this.db
        .select({
          id: products.id,
          sizes: products.sizes,
          colors: products.colors,
        })
        .from(products)
        .where(
          and(eq(products.id, input.productId), eq(products.isPublished, true)),
        );
      if (!product) return null;
      if (
        (product.sizes.length &&
          (!input.size || !product.sizes.includes(input.size))) ||
        (product.colors.length &&
          (!input.color || !product.colors.includes(input.color)))
      )
        return false;
    }
    if (input.eventId) {
      const [event] = await this.db
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.id, input.eventId),
            eq(events.isPublished, true),
            this.eventIsCurrent(),
          ),
        );
      if (!event) return null;
    }
    const requestNumber = `CAT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [result] = await this.db
      .insert(catalogRequests)
      .values({ ...input, customerId, requestNumber, status: "submitted" })
      .returning();
    return result!;
  }

  async patchRequest(id: string, input: CatalogRequestPatchInput) {
    const [result] = await this.db
      .update(catalogRequests)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(catalogRequests.id, id))
      .returning();
    return result ?? null;
  }

  async dashboard() {
    await this.deleteExpiredEvents();
    const actionableStatuses = [
      "submitted",
      "reviewing",
      "quoted",
      "confirmed",
      "ready",
    ];
    const activeWorkshopStatuses = [
      "received",
      "inspection",
      "diagnosis",
      "waiting_approval",
      "approved",
      "in_progress",
      "waiting_parts",
      "quality_check",
    ];
    const [workshopPending, workshopNeedsUpdate, requestCount, eventCount] =
      await Promise.all([
        this.db
          .select({ value: count() })
          .from(workshopRequests)
          .where(eq(workshopRequests.status, "pending")),
        this.db
          .select({ value: count() })
          .from(workshopOrders)
          .where(
            and(
              inArray(workshopOrders.status, activeWorkshopStatuses),
              sql`NOT EXISTS (SELECT 1 FROM ${workshopCustomerUpdates} u WHERE u.workshop_order_id = ${workshopOrders.id} AND u.created_at >= now() - interval '3 days')`,
            ),
          ),
        this.db
          .select({ value: count() })
          .from(catalogRequests)
          .where(inArray(catalogRequests.status, actionableStatuses)),
        this.db
          .select({ value: count() })
          .from(events)
          .where(
            and(eq(events.isPublished, true), this.eventIsCurrent()),
          ),
      ]);
    const [
      pendingWorkshopRequests,
      workshopUpdateNeeds,
      catalogRequestRows,
      upcomingEvents,
      recentLoyaltyMovements,
    ] = await Promise.all([
      this.db
        .select()
        .from(workshopRequests)
        .where(eq(workshopRequests.status, "pending"))
        .orderBy(asc(workshopRequests.createdAt))
        .limit(10),
      this.db
        .select()
        .from(workshopOrders)
        .where(
          and(
            inArray(workshopOrders.status, activeWorkshopStatuses),
            sql`NOT EXISTS (SELECT 1 FROM ${workshopCustomerUpdates} u WHERE u.workshop_order_id = ${workshopOrders.id} AND u.created_at >= now() - interval '3 days')`,
          ),
        )
        .orderBy(asc(workshopOrders.updatedAt))
        .limit(10),
      this.requestRows(
        inArray(catalogRequests.status, actionableStatuses),
      ).limit(10),
      this.db
        .select()
        .from(events)
        .where(
          and(eq(events.isPublished, true), this.eventIsCurrent()),
        )
        .orderBy(asc(events.startsAt))
        .limit(10),
      this.db
        .select({
          id: customerLoyaltyMovements.id,
          customerId: customerLoyaltyMovements.customerId,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          units: customerLoyaltyMovements.units,
          balanceAfter: customerLoyaltyMovements.balanceAfter,
          reason: customerLoyaltyMovements.reason,
          movementType: customerLoyaltyMovements.movementType,
          createdAt: customerLoyaltyMovements.createdAt,
        })
        .from(customerLoyaltyMovements)
        .innerJoin(
          customers,
          eq(customerLoyaltyMovements.customerId, customers.id),
        )
        .orderBy(desc(customerLoyaltyMovements.createdAt))
        .limit(10),
    ]);
    return {
      counts: {
        workshopPending: workshopPending[0]?.value ?? 0,
        workshopUpdateNeeds: workshopNeedsUpdate[0]?.value ?? 0,
        catalogRequests: requestCount[0]?.value ?? 0,
        upcomingEvents: eventCount[0]?.value ?? 0,
      },
      pendingWorkshopRequests,
      workshopUpdateNeeds,
      catalogRequests: catalogRequestRows,
      upcomingEvents,
      recentLoyaltyMovements,
    };
  }
}
