import { describe, expect, it } from "vitest";
import {
  customerBicycleSchema,
  customerProfileUpdateSchema,
  customerPasswordChangeSchema,
  customerWorkshopRequestSchema,
} from "@mi-bicla/api-contract";

describe("contratos mutables del portal", () => {
  it("no permite asignar cliente, estado ni notas internas a una bicicleta", () => {
    expect(customerBicycleSchema.safeParse({ nickname: "Mi bici" }).success).toBe(true);
    expect(customerBicycleSchema.safeParse({ nickname: "Mi bici", customerId: crypto.randomUUID() }).success).toBe(false);
    expect(customerBicycleSchema.safeParse({ nickname: "Mi bici", status: "inactive" }).success).toBe(false);
    expect(customerBicycleSchema.safeParse({ nickname: "Mi bici", notes: "internas" }).success).toBe(false);
  });

  it("el perfil no permite cambiar teléfono ni estado", () => {
    const valid = { firstName: "Ana", lastName: "Prueba", email: null, birthDate: null };
    expect(customerProfileUpdateSchema.safeParse(valid).success).toBe(true);
    expect(customerProfileUpdateSchema.safeParse({ ...valid, phone: "+524420000000" }).success).toBe(false);
    expect(customerProfileUpdateSchema.safeParse({ ...valid, status: "inactive" }).success).toBe(false);
  });

  it("una solicitud exige bicicleta propia y una descripción útil", () => {
    expect(customerWorkshopRequestSchema.safeParse({
      bicycleId: crypto.randomUUID(),
      serviceName: "Servicio completo",
      problemDescription: "La transmisión hace ruido al pedalear",
      preferredContactMethod: "whatsapp",
    }).success).toBe(true);
    expect(customerWorkshopRequestSchema.safeParse({
      bicycleId: crypto.randomUUID(),
      problemDescription: "ruido",
    }).success).toBe(false);
  });

  it("el cambio de contraseña exige contraseña actual y una nueva robusta", () => {
    expect(customerPasswordChangeSchema.safeParse({
      currentPassword: "Actual-Password1!",
      newPassword: "Nueva-Password2!",
    }).success).toBe(true);
    expect(customerPasswordChangeSchema.safeParse({
      currentPassword: "Actual-Password1!",
      newPassword: "debil",
    }).success).toBe(false);
  });
});
