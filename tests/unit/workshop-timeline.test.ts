import { describe, expect, it } from "vitest";
import { workshopTimelineMessage } from "../../artifacts/web/lib/workshop-timeline";

describe("bitácora del taller para clientes", () => {
  it("oculta mensajes técnicos generados automáticamente", () => {
    expect(workshopTimelineMessage("Estado actualizado: inspection", "Inspección")).toBeUndefined();
    expect(workshopTimelineMessage("Bicicleta recibida", "Recibida")).toBeUndefined();
    expect(workshopTimelineMessage(null, "Recibida")).toBeUndefined();
  });

  it("conserva mensajes realmente escritos por el taller", () => {
    expect(workshopTimelineMessage("Terminamos la revisión de frenos.", "Inspección"))
      .toBe("Terminamos la revisión de frenos.");
  });
});
