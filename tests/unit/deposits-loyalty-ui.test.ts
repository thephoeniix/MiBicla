import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  canonicalFinancialValue,
  copyFinancialValue,
  digitsOnly,
  formatFinancialInput,
  formatFinancialNumber,
  isValidClabe,
  maskedFinancialSummary,
  validateFinancialFields,
} from "../../artifacts/web/lib/deposits";
import {
  buildDepositPayload,
  depositConfigurationLabel,
  depositPaymentSummary,
  type DepositAdminOption,
} from "../../artifacts/web/pages/admin/settings/Deposits";
import { depositSettingsSchema } from "../../packages/api-contract/src/business-settings.schema";
import {
  loyaltySettingsChanged,
  moveLoyaltyStage,
  replaceLoyaltyRule,
} from "../../artifacts/web/lib/loyalty-settings";

describe("datos financieros públicos", () => {
  const SYNTHETIC_VALID_CLABE = "000000000000000000";
  const SYNTHETIC_CARD = "0000000000000";
  const SYNTHETIC_ACCOUNT = "00000001";
  const depositForm = {
    displayName: "Método sintético",
    bankName: "Proveedor sintético",
    accountHolder: "Titular sintético",
    accountNumber: "",
    clabe: "",
    cardNumber: "",
    referenceText: "Referencia sintética",
    instructions: "Instrucciones sintéticas",
    whatsappNumber: "",
    whatsappTemplate: "Plantilla sintética",
    showAccountNumber: false,
    showClabe: false,
    showCardNumber: false,
    showBank: true,
    showHolder: true,
    isActive: false,
    sortOrder: 0,
    clearAccountNumber: false,
    clearClabe: false,
    clearCardNumber: false,
  };
  const deposit: DepositAdminOption = {
    id: "deposit-test",
    displayName: "Transferencia",
    bankName: "Banco de prueba",
    accountHolder: "Persona de prueba",
    referenceText: "Referencia",
    instructions: "Instrucciones",
    whatsappNumber: "0000000000",
    whatsappTemplate: "Plantilla",
    showAccountNumber: false,
    showClabe: true,
    showCardNumber: false,
    showBank: true,
    showHolder: true,
    isActive: false,
    sortOrder: 0,
    hasAccountNumber: false,
    hasClabe: false,
    hasCardNumber: false,
  };

  it("copia únicamente dígitos aunque el valor esté formateado", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await copyFinancialValue("012 34-5678 9012 34567", { writeText });
    expect(writeText).toHaveBeenCalledWith("012345678901234567");
  });

  it("formatea para lectura y sólo muestra los últimos cuatro en administración", () => {
    expect(digitsOnly("**** 42-42")).toBe("4242");
    expect(formatFinancialNumber("012345678901234567")).toBe(
      "0123 4567 8901 2345 67",
    );
    expect(maskedFinancialSummary("012345678901234567")).toBe("•••• 4567");
  });

  it("normaliza CLABE con o sin espacios y conserva ceros iniciales", () => {
    expect(canonicalFinancialValue(SYNTHETIC_VALID_CLABE)).toBe(
      SYNTHETIC_VALID_CLABE,
    );
    expect(canonicalFinancialValue("0000 0000 0000 0000 00")).toBe(
      SYNTHETIC_VALID_CLABE,
    );
    expect(formatFinancialInput(SYNTHETIC_VALID_CLABE)).toBe(
      "0000 0000 0000 0000 00",
    );
    expect(isValidClabe(SYNTHETIC_VALID_CLABE)).toBe(true);
    expect(depositSettingsSchema.parse({
      ...depositForm,
      clabe: SYNTHETIC_VALID_CLABE,
    }).clabe).toBe(SYNTHETIC_VALID_CLABE);
  });

  it("rechaza dígito verificador incorrecto, letras y símbolos", () => {
    expect(isValidClabe("000000000000000001")).toBe(false);
    expect(validateFinancialFields({
      accountNumber: "",
      clabe: "0000 0000 0000 0000 01",
      cardNumber: "",
    }).clabe).toBe("Ingresa una CLABE válida de 18 dígitos.");
    expect(() => canonicalFinancialValue("0000A000")).toThrow();
    expect(formatFinancialInput("0000A000")).toBe("0000A000");
    expect(() => depositSettingsSchema.parse({
      ...depositForm,
      clabe: "000000000000000001",
    })).toThrow();
  });

  it("normaliza tarjeta y cuenta en la misma frontera de crear y editar", () => {
    const payload = buildDepositPayload({
      ...depositForm,
      accountNumber: "0000 0001",
      clabe: "0000 0000 0000 0000 00",
      cardNumber: "0000 0000 0000 0",
    });
    expect(payload).toMatchObject({
      accountNumber: SYNTHETIC_ACCOUNT,
      clabe: SYNTHETIC_VALID_CLABE,
      cardNumber: SYNTHETIC_CARD,
    });
    expect(payload.accountNumber).toMatch(/^\d+$/);
    expect(payload.clabe).toMatch(/^\d+$/);
    expect(payload.cardNumber).toMatch(/^\d+$/);

    const editPayload = buildDepositPayload(depositForm);
    expect(editPayload).toMatchObject({
      accountNumber: "",
      clabe: "",
      cardNumber: "",
    });
    expect(editPayload).not.toHaveProperty("maskedClabe");
    expect(editPayload).not.toHaveProperty("maskedCardNumber");
    expect(editPayload).not.toHaveProperty("maskedAccountNumber");
  });

  it("describe la configuración sin revelar información financiera", () => {
    expect(depositConfigurationLabel(deposit)).toBe("Faltan datos");
    expect(depositPaymentSummary(deposit)).toBe("Faltan datos de pago");
    expect(depositConfigurationLabel({ ...deposit, hasClabe: true })).toBe(
      "Listo para publicar",
    );
    expect(
      depositPaymentSummary({
        ...deposit,
        hasClabe: true,
        maskedClabe: "•••• 4567",
      }),
    ).toBe("•••• 4567");
  });

  it("conserva acciones accesibles, orden explícito y estructura responsive", () => {
    const component = readFileSync(
      new URL("../../artifacts/web/pages/admin/settings/Deposits.tsx", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL("../../artifacts/web/style.css", import.meta.url),
      "utf8",
    );
    expect(component).toContain("Más acciones para");
    expect(component).toContain("Mover arriba");
    expect(component).toContain("Mover abajo");
    expect(component).toContain('item.isActive ? "Ocultar método" : "Publicar método"');
    expect(component).toContain("Eliminar método");
    expect(component).toContain("Ingresa una CLABE válida de 18 dígitos.");
    expect(component).not.toContain("clabe: Invalid");
    expect(styles).toContain(
      "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    );
    expect(styles).toContain(".deposits-admin-page");
    expect(styles).toContain("overflow-x: clip");
    expect(styles).not.toContain(
      ".deposit-admin-card p { margin: 4px 0 0; overflow: hidden",
    );
  });
});

describe("flujo móvil de fidelidad", () => {
  it("limita la navegación a sus cuatro etapas", () => {
    expect(moveLoyaltyStage(1, -1)).toBe(1);
    expect(moveLoyaltyStage(1, 1)).toBe(2);
    expect(moveLoyaltyStage(4, 1)).toBe(4);
  });

  it("preserva las demás reglas al editar una durante la navegación", () => {
    const rules = [
      { minimumAmount: 10_000, units: 1 },
      { minimumAmount: 20_000, units: 2 },
    ];
    const result = replaceLoyaltyRule(rules, 1, { units: 3 });
    expect(result).toEqual([
      rules[0],
      { minimumAmount: 20_000, units: 3 },
    ]);
    expect(rules[1]?.units).toBe(2);
  });

  it("distingue un borrador modificado de la configuración guardada", () => {
    const original = { enabled: true, rewardUnits: 10 };
    expect(loyaltySettingsChanged(original, { ...original })).toBe(false);
    expect(
      loyaltySettingsChanged({ ...original, rewardUnits: 12 }, original),
    ).toBe(true);
  });
});
