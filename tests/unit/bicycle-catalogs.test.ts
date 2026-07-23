import { describe, expect, it } from "vitest";
import { bicycleSchema } from "@mi-bicla/api-contract";

describe("catálogos de bicicletas", () => {
  it("acepta valores de catálogo", () => {
    expect(
      bicycleSchema.parse({
        customerId: null,
        brand: "Trek",
        bikeType: "Montaña (MTB)",
        wheelSize: "29",
        brakeType: "Disco hidráulico",
        suspensionType: "Delantera",
        drivetrain: "Shimano",
        generalCondition: "Buena",
        status: "active",
      }),
    ).toMatchObject({ brand: "Trek", wheelSize: "29" });
  });

  it("permite valores nuevos que no estén en los catálogos", () => {
    expect(
      bicycleSchema.parse({
        brand: "Marca artesanal",
        color: "Verde tornasol",
        drivetrain: "Transmisión experimental",
        status: "active",
      }),
    ).toMatchObject({
      brand: "Marca artesanal",
      color: "Verde tornasol",
    });
  });
});
