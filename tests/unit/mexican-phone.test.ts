import { describe, expect, it } from "vitest";
import {
  customerCreateSchema,
  mexicanPhoneSchema,
  workshopRequestSchema,
} from "@mi-bicla/api-contract";

describe("teléfonos mexicanos", () => {
  it.each([
    "4462580377",
    "446 258 0377",
    "446-258-0377",
    "(446) 258 0377",
    "+52 446 258 0377",
    "+52 1 446 258 0377",
  ])("normaliza %s", (phone) => {
    expect(mexicanPhoneSchema.parse(phone)).toBe("+524462580377");
  });

  it("rechaza números que no tienen 10 dígitos", () => {
    expect(mexicanPhoneSchema.safeParse("446 258").success).toBe(false);
  });

  it("normaliza el teléfono de un cliente", () => {
    const result = customerCreateSchema.parse({
      firstName: "Ana",
      lastName: "López",
      phone: "446 258 0377",
      email: null,
      birthDate: null,
      notes: null,
      status: "active",
    });

    expect(result.phone).toBe("+524462580377");
  });

  it("normaliza el teléfono de una solicitud de taller", () => {
    const result = workshopRequestSchema.parse({
      customerName: "Ana López",
      customerPhone: "446 258 0377",
      customerEmail: null,
      bikeBrand: null,
      bikeModel: null,
      bikeType: null,
      problemDescription: "La cadena se sale constantemente",
      preferredContactMethod: "whatsapp",
    });

    expect(result.customerPhone).toBe("+524462580377");
  });
});
