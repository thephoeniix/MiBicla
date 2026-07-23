import { describe, expect, it } from "vitest";
import {
  workshopServiceCatalogSchema,
  workshopServiceSchema,
} from "@mi-bicla/api-contract";
import {
  formatMxn,
  parseMxnToCents,
} from "../../artifacts/web/components/WorkshopServices";

describe("catálogo de servicios de taller", () => {
  it("maneja precios como centavos enteros", () => {
    expect(parseMxnToCents("250")).toBe(25_000);
    expect(parseMxnToCents("$250.50 MXN")).toBe(25_050);
    expect(parseMxnToCents("10.999")).toBeNull();
    expect(formatMxn(25_000)).toContain("$250.00");
  });

  it("valida servicios configurables sin limitar el nombre", () => {
    expect(
      workshopServiceCatalogSchema.parse({
        name: "Ajuste personalizado",
        description: null,
        suggestedPriceCents: 12_345,
        estimatedDurationMinutes: 45,
        isCustomerVisible: true,
        isActive: true,
        sortOrder: 70,
      }).name,
    ).toBe("Ajuste personalizado");
  });

  it("guarda una instantánea editable en la orden", () => {
    expect(
      workshopServiceSchema.parse({
        catalogServiceId: "550e8400-e29b-41d4-a716-446655440000",
        serviceName: "Nombre aplicado en la orden",
        description: "Detalle específico",
        quantity: 2,
        unitPriceCents: 25_000,
        isCustomerVisible: true,
        status: "pending",
        performedBy: null,
      }),
    ).toMatchObject({
      serviceName: "Nombre aplicado en la orden",
      unitPriceCents: 25_000,
    });
  });
});
