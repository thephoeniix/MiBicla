import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  customerRegistrationSchema,
  registrationReviewIdSchema,
} from "../../packages/api-contract/src/customer-registration.schema";
import { sanitizeAuditMetadata, sha256 } from "@mi-bicla/shared";
import { buildRegistrationWhatsappUrl } from "../../artifacts/web/lib/customer-registration";
import {
  isRegistrationPasswordValid,
  registrationPasswordStatus,
} from "../../artifacts/web/lib/registration-password";

describe("solicitudes públicas de acceso", () => {
  const valid = {
    firstName: "Ana",
    lastName: "Prueba",
    phone: "442 123 4567",
  };

  it("acepta exclusivamente nombre, apellidos y teléfono, y normaliza el teléfono", () => {
    expect(customerRegistrationSchema.parse(valid)).toEqual({
      firstName: "Ana",
      lastName: "Prueba",
      phone: "+524421234567",
    });
  });

  it("rechaza password, email y cualquier campo adicional (.strict())", () => {
    expect(() =>
      customerRegistrationSchema.parse({ ...valid, password: "Fictional-Password1!" }),
    ).toThrow();
    expect(() =>
      customerRegistrationSchema.parse({ ...valid, email: "ana@example.test" }),
    ).toThrow();
    expect(() =>
      customerRegistrationSchema.parse({ ...valid, unexpected: true }),
    ).toThrow();
  });

  it("no ofrece campos de contraseña en la vista de registro — la contraseña se crea al activar", () => {
    const component = readFileSync(
      new URL("../../artifacts/web/pages/customer/CustomerAuth.tsx", import.meta.url),
      "utf8",
    );
    const registrationInfoBody = component.slice(
      component.indexOf("export function CustomerRegistrationInfo"),
      component.length,
    );
    expect(registrationInfoBody).not.toContain('type="password"');
    expect(registrationInfoBody).not.toContain('type="email"');
    expect(registrationInfoBody).not.toContain("Paso");
    expect(registrationInfoBody).toContain("Solicitar cuenta");
  });

  it("las reglas de contraseña (usadas ahora en la activación) siguen expresadas en español, sin jerga interna", () => {
    expect(isRegistrationPasswordValid("Fictional-Password1!")).toBe(true);
    expect(registrationPasswordStatus("débil")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "length", met: false }),
        expect.objectContaining({ id: "uppercase", met: false }),
        expect.objectContaining({ id: "number", met: false }),
      ]),
    );
    const visibleRequirementText = registrationPasswordStatus("")
      .map(({ label }) => label)
      .join(" ");
    expect(visibleRequirementText).not.toMatch(/password|invalid/i);
  });

  it("exige reviewId opaco y no secuencial", () => {
    expect(registrationReviewIdSchema.parse("a".repeat(64))).toHaveLength(64);
    expect(() => registrationReviewIdSchema.parse("123")).toThrow();
    expect(() => registrationReviewIdSchema.parse("1")).toThrow();
  });

  it("permite rate limit con hash sin persistir teléfono original", () => {
    const phone = "+524421234567";
    const key = `customer-registration:ip-phone:127.0.0.1:${sha256(phone)}`;
    expect(key).not.toContain(phone);
    expect(key).toMatch(/[a-f0-9]{64}$/);
  });

  it("elimina contraseña, hash, teléfono y correo de auditoría (sigue vigente aunque el registro ya no los pida)", () => {
    expect(sanitizeAuditMetadata({
      password: "Fictional-Password1!",
      passwordHash: "argon",
      phone: valid.phone,
      email: "ana@example.test",
      reference: "MB-TEST",
    })).toEqual({ reference: "MB-TEST" });
  });

  it("prepara WhatsApp manual con referencia y localizador sin credenciales", () => {
    const reviewId = "b".repeat(64);
    const url = buildRegistrationWhatsappUrl("+52 442 123 4567", {
      name: "Ana Prueba",
      reference: "MB-ABC12345",
      adminReviewUrl: `https://mibicla.example/admin/customers/requests/${reviewId}`,
    });
    expect(url).toContain("https://wa.me/524421234567?text=");
    const message = decodeURIComponent(new URL(url!).searchParams.get("text")!);
    expect(message).toContain("Hola, solicito verificar mi cuenta Mi Bicla.");
    expect(message).toContain("Referencia: MB-ABC12345");
    expect(message).toContain(reviewId);
    expect(message).not.toMatch(/password|csrf|cookie|session/i);
    expect(buildRegistrationWhatsappUrl("", {
      name: "Ana", reference: "MB-TEST", adminReviewUrl: "https://mibicla.example/admin",
    })).toBeNull();
  });
});
