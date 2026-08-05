import { describe, expect, it } from "vitest";
import {
  customerCreateSchema,
  mexicanPhoneSchema,
  workshopRequestSchema,
} from "@mi-bicla/api-contract";

describe("teléfonos mexicanos", () => {
  it.each([
    "4420000000",
    "442 000 0000",
    "442-000-0000",
    "(442) 000 0000",
    "+52 442 000 0000",
    "+52 1 442 000 0000",
  ])("normaliza %s", (phone) => {
    expect(mexicanPhoneSchema.parse(phone)).toBe("+524420000000");
  });

  it("rechaza números que no tienen 10 dígitos", () => {
    expect(mexicanPhoneSchema.safeParse("442 000").success).toBe(false);
  });

  it("normaliza el teléfono de un cliente", () => {
    const result = customerCreateSchema.parse({
      firstName: "Ana",
      lastName: "López",
      phone: "442 000 0000",
      email: null,
      birthDate: null,
      notes: null,
      status: "active",
    });

    expect(result.phone).toBe("+524420000000");
  });

  it("normaliza el teléfono de una solicitud de taller", () => {
    const result = workshopRequestSchema.parse({
      customerName: "Ana López",
      customerPhone: "442 000 0000",
      customerEmail: null,
      bikeBrand: null,
      bikeModel: null,
      bikeType: null,
      problemDescription: "La cadena se sale constantemente",
      preferredContactMethod: "whatsapp",
    });

    expect(result.customerPhone).toBe("+524420000000");
  });
});
