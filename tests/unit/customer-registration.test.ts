import { describe, expect, it } from "vitest";
import {
  customerRegistrationSchema,
  registrationReviewIdSchema,
} from "../../packages/api-contract/src/customer-registration.schema";
import { sanitizeAuditMetadata, sha256 } from "@mi-bicla/shared";
import { buildRegistrationWhatsappUrl } from "../../artifacts/web/lib/customer-registration";

describe("solicitudes públicas de acceso", () => {
  const valid = {
    firstName: "Ana",
    lastName: "Prueba",
    phone: "442 123 4567",
    email: "ana@example.test",
    password: "Fictional-Password1!",
  };

  it("normaliza datos y aplica las reglas existentes de contraseña", () => {
    expect(customerRegistrationSchema.parse(valid)).toMatchObject({
      phone: "+524421234567",
      email: "ana@example.test",
    });
    expect(() => customerRegistrationSchema.parse({ ...valid, password: "weak" })).toThrow();
    expect(() => customerRegistrationSchema.parse({ ...valid, unexpected: true })).toThrow();
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

  it("elimina contraseña, hash, teléfono y correo de auditoría", () => {
    expect(sanitizeAuditMetadata({
      password: valid.password,
      passwordHash: "argon",
      phone: valid.phone,
      email: valid.email,
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
