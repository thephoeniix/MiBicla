import { describe, expect, it } from "vitest";
import {
  calculateSessionRenewal,
  generateSessionToken,
  hashSessionToken,
  normalizeEmail,
  sanitizeAuditMetadata,
  safeTokenCompare,
} from "@mi-bicla/shared";
describe("seguridad", () => {
  it("normaliza correo", () =>
    expect(normalizeEmail(" Foo@EXAMPLE.COM ")).toBe("foo@example.com"));
  it("genera y hashea tokens", () => {
    const t = generateSessionToken(),
      h = hashSessionToken(t);
    expect(t).toHaveLength(64);
    expect(h).toHaveLength(64);
    expect(safeTokenCompare(h, hashSessionToken(t))).toBe(true);
  });
  it("elimina secretos", () =>
    expect(
      sanitizeAuditMetadata({ ok: 1, password: "x", nested: { token: "x" } }),
    ).toEqual({ ok: 1, nested: {} }));
  it("renueva solo tras cinco minutos y respeta límite", () => {
    const now = new Date("2026-01-01T01:00:00Z");
    expect(
      calculateSessionRenewal(
        now,
        new Date("2026-01-01T00:56:00Z"),
        new Date("2026-01-01T08:00:00Z"),
      ),
    ).toBeNull();
    expect(
      calculateSessionRenewal(
        now,
        new Date("2026-01-01T00:50:00Z"),
        new Date("2026-01-01T01:20:00Z"),
      )?.toISOString(),
    ).toBe("2026-01-01T01:20:00.000Z");
  });
});
