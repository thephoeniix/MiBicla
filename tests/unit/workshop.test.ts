import { describe, expect, it } from "vitest";
import {
  calculateWorkshopTotals,
  canTransition,
  workshopWhatsappUrl,
} from "../../artifacts/api/src/services/workshop.service";
import {
  workshopRequestSchema,
  workshopStatusSchema,
  workshopUpdateSchema,
} from "@mi-bicla/api-contract";
import {
  generateSessionToken,
  PERMISSION_NAMES,
  ROLE_PERMISSIONS,
  sanitizeAuditMetadata,
  sha256,
} from "@mi-bicla/shared";
describe("Taller", () => {
  it("acepta transiciones válidas y rechaza finales", () => {
    expect(canTransition("received", "inspection")).toBe(true);
    expect(canTransition("waiting_parts", "in_progress")).toBe(true);
    expect(canTransition("delivered", "in_progress")).toBe(false);
    expect(canTransition("inspection", "in_progress")).toBe(true);
    expect(canTransition("inspection", "diagnosis")).toBe(false);
    expect(canTransition("in_progress", "cancelled")).toBe(false);
  });
  it("calcula totales en servidor ignorando cancelados", () =>
    expect(
      calculateWorkshopTotals(
        [
          { status: "completed", totalCents: 10000 },
          { status: "cancelled", totalCents: 9000 },
        ],
        [{ status: "installed", totalCents: 5000 }],
        2000,
      ),
    ).toEqual({
      subtotalServicesCents: 10000,
      subtotalPartsCents: 5000,
      totalCents: 13000,
    }));
  it("valida solicitud pública y rechaza campos internos", () => {
    const valid = {
      customerName: "Ana López",
      customerPhone: "+524421234567",
      customerEmail: "",
      bikeBrand: "Trek",
      bikeModel: "X",
      bikeType: "montaña",
      problemDescription: "Los frenos no responden correctamente",
      preferredContactMethod: "whatsapp",
    };
    expect(workshopRequestSchema.parse(valid)).toMatchObject({
      customerEmail: null,
    });
    expect(() =>
      workshopRequestSchema.parse({ ...valid, internalNotes: "privado" }),
    ).toThrow();
    expect(() =>
      workshopRequestSchema.parse({ ...valid, totalCents: 1 }),
    ).toThrow();
  });
  it("valida avances y bloquea HTML/progreso inválido", () => {
    expect(() =>
      workshopUpdateSchema.parse({
        title: "<script>",
        message: "x",
        progressPercent: 101,
        photoUrl: null,
        customerVisible: true,
      }),
    ).toThrow();
  });
  it("genera token opaco guardable sólo como SHA-256", () => {
    const token = generateSessionToken();
    expect(sha256(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256(token)).not.toBe(token);
  });
  it("codifica WhatsApp sin notas internas", () => {
    const url = workshopWhatsappUrl("+52 442", "Orden {orden}: {estado}", {
      orden: "OT-1",
      estado: "lista",
    });
    expect(decodeURIComponent(url)).toContain("Orden OT-1: lista");
    expect(url).not.toContain("internal");
  });
  it("permite entrega desde ready pero no desde estados previos", () => {
    expect(canTransition("ready", "delivered")).toBe(true);
    expect(canTransition("inspection", "delivered")).toBe(false);
    expect(
      workshopStatusSchema.parse({
        status: "delivered",
        publicMessage: null,
        internalReason: null,
        customerVisible: true,
        force: false,
      }).status,
    ).toBe("delivered");
  });
  it("asigna permisos financieros sólo a owner/admin", () => {
    for (const p of [
      "view_bicycles",
      "manage_workshop_status",
      "publish_workshop_updates",
      "notify_workshop_customers",
    ]) {
      expect(PERMISSION_NAMES).toContain(p);
      expect(ROLE_PERMISSIONS.employee).toContain(p as never);
    }
    for (const p of [
      "view_workshop_financials",
      "manage_workshop_financials",
      "manage_workshop_settings",
    ]) {
      expect(ROLE_PERMISSIONS.owner).toContain(p as never);
      expect(ROLE_PERMISSIONS.admin).toContain(p as never);
      expect(ROLE_PERMISSIONS.employee).not.toContain(p as never);
    }
  });
  it("sanitiza auditoría sin tokens ni datos sensibles", () =>
    expect(
      sanitizeAuditMetadata({
        token: "x",
        token_hash: "x",
        phone: "+524421234567",
        email: "x@example.com",
        action: "status",
      }),
    ).toEqual({ action: "status" }));
});
