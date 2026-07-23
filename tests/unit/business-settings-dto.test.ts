import { describe, expect, it } from "vitest";
import { businessSettingsUpdateSchema } from "@mi-bicla/api-contract";
import {
  buildGeneralPayload,
  EMPTY_BUSINESS,
} from "../../artifacts/web/pages/admin/settings/General";
import { buildSocialPayload } from "../../artifacts/web/pages/admin/settings/Social";
const received = {
  ...EMPTY_BUSINESS,
  id: "00000000-0000-0000-0000-000000000001",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-02",
  updatedBy: null,
};
describe("DTO Business Settings", () => {
  it("General omite metadatos y campos sociales", () => {
    const payload = buildGeneralPayload(received);
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("facebook");
  });
  it("Social envía exclusivamente redes", () => {
    const payload = buildSocialPayload(received);
    expect(Object.keys(payload)).toEqual([
      "facebook",
      "instagram",
      "tiktok",
      "website",
    ]);
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("updatedAt");
  });
  it.each(["tiktok", "website", "logoUrl", "faviconUrl"] as const)(
    "normaliza %s vacío a null",
    (field) => {
      const parsed = businessSettingsUpdateSchema.parse({ [field]: "  " });
      expect(parsed[field]).toBeNull();
    },
  );
  it("una actualización parcial conserva campos omitidos", () => {
    const parsed = businessSettingsUpdateSchema.parse({
      facebook: "https://facebook.com/mibicla",
    });
    expect(parsed).toEqual({ facebook: "https://facebook.com/mibicla" });
    expect(parsed).not.toHaveProperty("businessName");
  });
  it("rechaza URLs inválidas", () => {
    expect(() =>
      businessSettingsUpdateSchema.parse({ website: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      businessSettingsUpdateSchema.parse({ tiktok: "tiktok.com/x" }),
    ).toThrow();
  });
  it("acepta y recorta URLs HTTP/HTTPS", () => {
    expect(
      businessSettingsUpdateSchema.parse({ website: " https://mibicla.mx " })
        .website,
    ).toBe("https://mibicla.mx");
    expect(
      businessSettingsUpdateSchema.parse({
        logoUrl: "http://cdn.test/logo.png",
      }).logoUrl,
    ).toBe("http://cdn.test/logo.png");
  });
  it("rechaza metadatos de solo lectura", () =>
    expect(() => businessSettingsUpdateSchema.parse({ id: "x" })).toThrow());
});
