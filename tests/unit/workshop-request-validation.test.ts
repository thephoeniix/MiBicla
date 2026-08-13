import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findInvalidWorkshopFields,
  isValidWorkshopBikeField,
  isValidWorkshopCustomerName,
  isValidWorkshopEmail,
  isValidWorkshopPhone,
  isValidWorkshopProblemDescription,
  normalizeWorkshopPhone,
  type WorkshopRequestFields,
} from "../../artifacts/web/lib/workshop-request-validation";
import { workshopRequestSchema } from "../../packages/api-contract/src/workshop.schema";

const requestSource = readFileSync("artifacts/web/components/WorkshopRequestFlow.tsx", "utf8");

function validRequest(overrides: Partial<WorkshopRequestFields> = {}): WorkshopRequestFields {
  return {
    customerName: "Ana Prueba",
    customerPhone: "442 000 0000",
    customerEmail: "ana@example.test",
    bikeBrand: "Trek",
    bikeModel: "Marlin 7",
    bikeType: "MTB",
    problemDescription: "El freno trasero truena al frenar en descenso.",
    ...overrides,
  };
}

describe("normalización de teléfono — igual que normalizeMexicanPhone del contrato", () => {
  it("acepta 10 dígitos con o sin formato", () => {
    expect(normalizeWorkshopPhone("442 000 0000")).toBe("+524420000000");
    expect(normalizeWorkshopPhone("4420000000")).toBe("+524420000000");
  });

  it("normaliza prefijos +52 y 521 como el contrato", () => {
    expect(normalizeWorkshopPhone("+52 442 000 0000")).toBe("+524420000000");
    expect(normalizeWorkshopPhone("521 442 000 0000")).toBe("+524420000000");
  });
});

describe("validación local — misma regla que workshopRequestSchema", () => {
  it("customerName exige al menos 2 caracteres (safe(150, 2))", () => {
    expect(isValidWorkshopCustomerName("Al")).toBe(true);
    expect(isValidWorkshopCustomerName("A")).toBe(false);
    expect(isValidWorkshopCustomerName("  ")).toBe(false);
    expect(isValidWorkshopCustomerName("a".repeat(151))).toBe(false);
    expect(isValidWorkshopCustomerName("<script>")).toBe(false);
  });

  it("customerPhone exige 10 dígitos mexicanos (mexicanPhoneSchema)", () => {
    expect(isValidWorkshopPhone("442 000 0000")).toBe(true);
    expect(isValidWorkshopPhone("123")).toBe(false);
    expect(isValidWorkshopPhone("")).toBe(false);
  });

  it("customerEmail es opcional — vacío es válido porque el contrato lo envuelve en opt()", () => {
    expect(isValidWorkshopEmail("")).toBe(true);
    expect(isValidWorkshopEmail("   ")).toBe(true);
    expect(isValidWorkshopEmail("ana@example.test")).toBe(true);
    expect(isValidWorkshopEmail("no-es-correo")).toBe(false);
    expect(isValidWorkshopEmail(`${"a".repeat(250)}@x.com`)).toBe(false);
  });

  it("bikeBrand/bikeModel/bikeType son opcionales — opt(safe(100)), no exigen contenido", () => {
    expect(isValidWorkshopBikeField("")).toBe(true);
    expect(isValidWorkshopBikeField("   ")).toBe(true);
    expect(isValidWorkshopBikeField("Trek")).toBe(true);
    expect(isValidWorkshopBikeField("a".repeat(101))).toBe(false);
    expect(isValidWorkshopBikeField("<img>")).toBe(false);
  });

  it("problemDescription exige al menos 10 caracteres (safe(3000, 10))", () => {
    expect(isValidWorkshopProblemDescription("muy corto")).toBe(false);
    expect(isValidWorkshopProblemDescription("Descripción suficientemente larga.")).toBe(true);
  });

  it("findInvalidWorkshopFields no marca nada cuando todo es válido, incluidos los campos de bici vacíos", () => {
    expect(findInvalidWorkshopFields(validRequest())).toEqual([]);
    expect(
      findInvalidWorkshopFields(
        validRequest({ bikeBrand: "", bikeModel: "", bikeType: "" }),
      ),
    ).toEqual([]);
  });

  it("findInvalidWorkshopFields reporta cada campo inválido de forma independiente", () => {
    expect(findInvalidWorkshopFields(validRequest({ customerName: "A" }))).toEqual([
      "customerName",
    ]);
    expect(findInvalidWorkshopFields(validRequest({ customerPhone: "123" }))).toEqual([
      "customerPhone",
    ]);
    expect(findInvalidWorkshopFields(validRequest({ customerEmail: "no-es-correo" }))).toEqual([
      "customerEmail",
    ]);
    expect(
      findInvalidWorkshopFields(
        validRequest({ customerName: "A", customerPhone: "123" }),
      ),
    ).toEqual(["customerName", "customerPhone"]);
  });

  it("coincide con el contrato compartido en los mismos casos límite (verificación cruzada)", () => {
    const cases: Array<[WorkshopRequestFields, boolean]> = [
      [validRequest(), true],
      [validRequest({ customerName: "A" }), false],
      [validRequest({ customerPhone: "123" }), false],
      [validRequest({ customerEmail: "no-es-correo" }), false],
      [validRequest({ customerEmail: "" }), true],
      [validRequest({ bikeBrand: "", bikeModel: "", bikeType: "" }), true],
      [validRequest({ problemDescription: "corto" }), false],
    ];
    for (const [candidate, expected] of cases) {
      const localValid = findInvalidWorkshopFields(candidate).length === 0;
      const contractValid = workshopRequestSchema.safeParse({
        ...candidate,
        preferredContactMethod: "whatsapp",
      }).success;
      expect(localValid).toBe(expected);
      expect(contractValid).toBe(expected);
    }
  });
});

describe("integración en WorkshopRequestFlow — validación por pasos", () => {
  it("valida identidad, bicicleta, servicio y agenda antes de avanzar", () => {
    expect(requestSource).toContain("isValidMexicanPhone(draft.customerPhone)");
    expect(requestSource).toContain("authenticated ? !draft.bicycleId : !draft.bikeBrand || !draft.bikeType");
    expect(requestSource).toContain("draft.problemDescription.trim().length < 10");
    expect(requestSource).toContain("availability?.configured && (!draft.requestedDate || !draft.requestedTime)");
  });

  it("conserva el borrador y sólo lo limpia tras enviar correctamente", () => {
    expect(requestSource).toContain("sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))");
    expect(requestSource).toContain("await onSubmit(draft); if (!authenticated) sessionStorage.removeItem(STORAGE_KEY)");
  });

  it("enfoca el título al cambiar de paso y advierte antes de abandonar", () => {
    expect(requestSource).toContain("heading.current?.focus()");
    expect(requestSource).toContain('window.addEventListener("beforeunload", warn)');
  });
});
