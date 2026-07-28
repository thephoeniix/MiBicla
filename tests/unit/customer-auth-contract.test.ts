import { describe, expect, it } from "vitest";
import {
  customerLoginSchema,
  customerPasswordTokenSchema,
} from "../../packages/api-contract/src/customer-auth.schema";

describe("contratos de autenticación de clientes", () => {
  it("normaliza el teléfono mexicano del login", () => {
    expect(
      customerLoginSchema.parse({
        phone: "442 000 0001",
        password: "Fictional-Password1!",
      }).phone,
    ).toBe("+524420000001");
  });

  it("exige token opaco y contraseña robusta", () => {
    expect(() =>
      customerPasswordTokenSchema.parse({
        token: "not-a-token",
        password: "weak",
      }),
    ).toThrow();
    expect(
      customerPasswordTokenSchema.parse({
        token: "a".repeat(64),
        password: "Fictional-Password1!",
      }),
    ).toBeTruthy();
  });
});
