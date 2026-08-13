import { describe, expect, it } from "vitest";
import {
  catalogRequestCreateSchema,
  catalogRequestPatchSchema,
  eventCreateSchema,
  eventProductsUpdateSchema,
  productCreateSchema,
} from "@mi-bicla/api-contract";
import { PERMISSION_NAMES, ROLE_PERMISSIONS } from "@mi-bicla/shared";

describe("commerce contracts", () => {
  it("applies safe product defaults and rejects unknown fields", () => {
    const product = productCreateSchema.parse({
      name: "Casco",
      description: "Casco urbano",
      category: "seguridad",
    });
    expect(product).toMatchObject({
      sizes: [],
      colors: [],
      discountPercent: 0,
      isPublished: false,
    });
    expect(() =>
      productCreateSchema.parse({ ...product, inventory: 3 }),
    ).toThrow();
    expect(() =>
      productCreateSchema.parse({ ...product, discountPercent: 101 }),
    ).toThrow();
  });

  it("requires a product description and event for event fulfillment", () => {
    expect(() =>
      catalogRequestCreateSchema.parse({
        kind: "quote",
        quantity: 1,
        fulfillment: "store",
      }),
    ).toThrow();
    expect(() =>
      catalogRequestCreateSchema.parse({
        kind: "reservation",
        customProductName: "Bicicleta especial",
        quantity: 1,
        fulfillment: "event",
      }),
    ).toThrow();
    expect(
      catalogRequestCreateSchema.parse({
        kind: "quote",
        customProductName: "Bicicleta especial",
        quantity: 1,
        fulfillment: "store",
      }).customProductName,
    ).toBe("Bicicleta especial");
  });

  it("validates event ordering, deduplicates associations, and requires patches", () => {
    expect(() =>
      eventCreateSchema.parse({
        title: "Rodada",
        category: "Ruta",
        location: "Centro",
        startsAt: "2026-08-20T12:00:00Z",
        endsAt: "2026-08-20T11:00:00Z",
      }),
    ).toThrow();
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      eventProductsUpdateSchema.parse({ productIds: [id, id] }).productIds,
    ).toEqual([id]);
    expect(() => catalogRequestPatchSchema.parse({})).toThrow();
  });

  it("persists event category/map and requires complete shipping details", () => {
    const event = eventCreateSchema.parse({
      title: "Copa",
      category: "XCO",
      location: "Querétaro",
      mapUrl: "https://maps.google.com/?q=Queretaro",
      startsAt: "2026-08-20T12:00:00Z",
    });
    expect(event).toMatchObject({
      category: "XCO",
      mapUrl: "https://maps.google.com/?q=Queretaro",
    });
    expect(() =>
      catalogRequestCreateSchema.parse({
        kind: "quote",
        customProductName: "Casco",
        quantity: 1,
        fulfillment: "shipping",
      }),
    ).toThrow();
    const request = catalogRequestCreateSchema.parse({
      kind: "quote",
      customProductName: "Casco",
      quantity: 1,
      fulfillment: "shipping",
      recipientName: "Ana",
      shippingPhone: "4421234567",
      street: "Zapata 10",
      neighborhood: "Centro",
      city: "La Cañada",
      state: "Querétaro",
      postalCode: "76240",
      shippingCarrier: "DHL",
    });
    expect(request).toMatchObject({
      fulfillment: "shipping",
      shippingCarrier: "DHL",
      postalCode: "76240",
    });
  });

  it("assigns request management only to owner and admin", () => {
    expect(PERMISSION_NAMES).toContain("manage_catalog_requests");
    expect(ROLE_PERMISSIONS.owner).toContain("manage_catalog_requests");
    expect(ROLE_PERMISSIONS.admin).toContain("manage_catalog_requests");
    expect(ROLE_PERMISSIONS.employee).not.toContain(
      "manage_catalog_requests" as never,
    );
  });
});
