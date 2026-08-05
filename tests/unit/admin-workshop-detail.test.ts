import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workshopSource = readFileSync(
  "artifacts/web/pages/admin/Workshop.tsx",
  "utf8",
);
const workshopServicesSource = readFileSync(
  "artifacts/web/components/WorkshopServices.tsx",
  "utf8",
);
const styles = readFileSync("artifacts/web/style.css", "utf8");

describe("detalle administrativo de órdenes del taller", () => {
  it("conserva las cinco vistas y las acciones operativas existentes", () => {
    for (const label of ["Resumen", "Estado", "Servicios", "Costos", "Cliente"]) {
      expect(workshopSource).toContain(`label: "${label}"`);
    }

    expect(workshopServicesSource).toContain("Agregar servicio");
    expect(workshopSource).toContain("Preparar WhatsApp");
    expect(workshopSource).toContain("Generar seguimiento");
    expect(workshopSource).toContain("PRIMARY_TRANSITION");
  });

  it("presenta una cabecera contextual y una acción siguiente destacada", () => {
    expect(workshopSource).toContain('className="workshop-detail-identity"');
    expect(workshopSource).toContain('className="order-summary-next"');
    expect(workshopSource).toContain("detailCustomer");
    expect(styles).toContain(".workshop-detail-identity > div");
    expect(styles).toContain(".order-summary-next");
  });

  it("mantiene la experiencia mobile-first y el detalle amplio en escritorio", () => {
    expect(workshopSource).toContain('className="workshop-detail-sticky"');
    expect(workshopSource).toContain('className="service-actions-menu"');
    expect(styles).toContain("@media (max-width: 599px)");
    expect(styles).toContain("height: 100dvh");
    expect(styles).toContain(".workshop-detail .ui-stepper");
    expect(styles).toContain("@media (min-width: 600px)");
    expect(styles).toContain("width: min(calc(100% - 40px), 920px)");
  });
});
