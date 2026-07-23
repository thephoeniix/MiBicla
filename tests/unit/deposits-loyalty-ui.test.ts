import { describe, expect, it, vi } from "vitest";
import {
  copyFinancialValue,
  digitsOnly,
  formatFinancialNumber,
  maskedFinancialSummary,
} from "../../artifacts/web/lib/deposits";
import {
  loyaltySettingsChanged,
  moveLoyaltyStage,
  replaceLoyaltyRule,
} from "../../artifacts/web/lib/loyalty-settings";

describe("datos financieros públicos", () => {
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
