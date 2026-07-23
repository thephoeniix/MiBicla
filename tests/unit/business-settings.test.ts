import { describe, expect, it, vi } from "vitest";
import {
  decrypt,
  encrypt,
  PERMISSION_NAMES,
  ROLE_PERMISSIONS,
} from "@mi-bicla/shared";
import { depositSettingsSchema } from "@mi-bicla/api-contract";
import { copyText, whatsappUrl } from "../../artifacts/web/lib/business";
import {
  resolveSensitiveField,
  toPublicDeposit,
} from "../../artifacts/api/src/services/business-settings.service";
const key = "11".repeat(32);
const base = {
  id: "00000000-0000-0000-0000-000000000001",
  businessSettingsId: "00000000-0000-0000-0000-000000000002",
  displayName: "BBVA",
  bankName: "Banco",
  accountHolder: "Titular",
  accountNumberEncrypted: encrypt("123", key),
  clabeEncrypted: encrypt("123456789012345678", key),
  cardNumberEncrypted: encrypt("1234567890123", key),
  referenceText: "Pedido",
  instructions: "Envía comprobante",
  whatsappNumber: "+524421234567",
  whatsappTemplate: "Hola {nombre}",
  showAccountNumber: false,
  showClabe: false,
  showCardNumber: false,
  showBank: true,
  showHolder: true,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  updatedBy: null,
};
describe("Business Settings", () => {
  it("cifra con nonce y autentica", () => {
    const a = encrypt("secreto", key),
      b = encrypt("secreto", key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe("secreto");
    expect(() => decrypt(`${a}x`, key)).toThrow();
  });
  it("conserva secretos vacíos y permite limpieza explícita", () => {
    process.env.APP_ENCRYPTION_KEY = key;
    const current = encrypt("1234", key);
    expect(resolveSensitiveField("", false, current)).toBe(current);
    expect(resolveSensitiveField("", true, current)).toBeNull();
    expect(decrypt(resolveSensitiveField("5678", false, current)!, key)).toBe(
      "5678",
    );
  });
  it("valida depósitos", () => {
    expect(() => depositSettingsSchema.parse({})).toThrow();
    expect(() =>
      depositSettingsSchema.parse({
        bankName: "B",
        accountHolder: "T",
        accountNumber: "12",
        clabe: "1",
        cardNumber: "123",
        referenceText: "R",
        instructions: "I",
        whatsappNumber: "+524421234567",
        whatsappTemplate: "X",
        showAccountNumber: false,
        showClabe: true,
        showCardNumber: false,
        showBank: true,
        showHolder: true,
        isActive: true,
      }),
    ).toThrow();
  });
  it("asigna permisos sólo a owner/admin", () => {
    for (const p of [
      "view_business_settings",
      "manage_business_settings",
      "view_deposit_settings",
      "manage_deposit_settings",
    ]) {
      expect(PERMISSION_NAMES).toContain(p);
      expect(ROLE_PERMISSIONS.owner).toContain(p);
      expect(ROLE_PERMISSIONS.admin).toContain(p);
      expect(ROLE_PERMISSIONS.employee).not.toContain(p as never);
    }
  });
  it("omite todos los datos bancarios deshabilitados", () => {
    process.env.APP_ENCRYPTION_KEY = key;
    expect(toPublicDeposit(base)).toMatchObject({
      bankName: "Banco",
      accountHolder: "Titular",
      accountNumber: undefined,
      clabe: undefined,
      cardNumber: undefined,
    });
  });
  it("copia mediante Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await copyText("CLABE", { clipboard: { writeText } as Clipboard });
    expect(writeText).toHaveBeenCalledWith("CLABE");
  });
  it("construye WhatsApp y sustituye variables", () => {
    const url = whatsappUrl(
      "+52 442",
      "Hola {nombre}: {monto} {concepto} {pedido}",
      {
        nombre: "Ana",
        monto: "100",
        concepto: "Bici",
        pedido: "42",
        banco: "BBVA",
      },
    );
    expect(url).toContain("https://wa.me/52442?text=");
    expect(decodeURIComponent(url)).toContain("Hola Ana: 100 Bici 42");
  });
});
