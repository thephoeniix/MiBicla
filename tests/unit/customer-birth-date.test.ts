import { describe, expect, it } from "vitest";
import { customerCreateSchema } from "@mi-bicla/api-contract";
import {
  buildCustomerPayload,
  toIsoDateInput,
} from "../../artifacts/web/pages/admin/Customers";
const customer = {
  firstName: "Ana",
  lastName: "López",
  phone: "+524421234567",
  email: "",
  birthDate: "",
  notes: "",
  status: "active",
};
describe("fecha de nacimiento", () => {
  it("acepta 2001-01-26", () =>
    expect(
      customerCreateSchema.parse({ ...customer, birthDate: "2001-01-26" })
        .birthDate,
    ).toBe("2001-01-26"));
  it("rechaza 01/26/2001", () =>
    expect(() =>
      customerCreateSchema.parse({ ...customer, birthDate: "01/26/2001" }),
    ).toThrow(/YYYY-MM-DD/));
  it("convierte cadena vacía a null", () => {
    expect(
      customerCreateSchema.parse({ ...customer, birthDate: "" }).birthDate,
    ).toBeNull();
    expect(buildCustomerPayload(customer).birthDate).toBeNull();
  });
  it("normaliza valores recibidos para el selector", () =>
    expect(toIsoDateInput("2001-01-26T00:00:00.000Z")).toBe("2001-01-26"));
  it("rechaza fechas futuras", () =>
    expect(() =>
      customerCreateSchema.parse({ ...customer, birthDate: "2999-01-01" }),
    ).toThrow(/futuro/));
});
