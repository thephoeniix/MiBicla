import { describe, expect, it } from "vitest";
import {
  calculateSessionRenewal,
  generateSessionToken,
  hashSessionToken,
  normalizeEmail,
  sanitizeAuditMetadata,
  safeTokenCompare,
  parseEnv,
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
  it("exige HTTPS, loopback, un proxy y orígenes exactos en producción", () => {
    const production = {
      DATABASE_URL: "postgresql://user:secret@db.example.com/mibicla",
      NODE_ENV: "production",
      APP_BASE_URL: "https://mibicla.example.com",
      API_BASE_URL: "https://mibicla.example.com",
      SESSION_SECRET: "a".repeat(32),
      APP_ENCRYPTION_KEY: "1".repeat(64),
      TRUST_PROXY: "1",
      ALLOWED_ORIGINS: "https://mibicla.example.com",
      HOST: "127.0.0.1",
      PORT: "3000",
    };
    expect(parseEnv(production).HOST).toBe("127.0.0.1");
    expect(() => parseEnv({ ...production, APP_BASE_URL: "http://mibicla.example.com" })).toThrow();
    expect(() => parseEnv({ ...production, TRUST_PROXY: "2" })).toThrow();
    expect(() => parseEnv({ ...production, HOST: "0.0.0.0" })).toThrow();
    expect(() => parseEnv({ ...production, ALLOWED_ORIGINS: "https://mibicla.example.com/" })).toThrow();
    expect(() => parseEnv({ ...production, ALLOWED_ORIGINS: "" })).toThrow();
  });
});
