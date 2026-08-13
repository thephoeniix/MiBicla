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
const uiSource = readFileSync("artifacts/web/components/ui.tsx", "utf8");

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
    expect(styles).toContain("width: min(calc(100% - 48px), 1120px)");
    expect(styles).toMatch(/\.order-status-layout\s*\{[^}]*grid-template-columns:/);
  });

  it("simplifica Estado y exige confirmar los cambios manuales", () => {
    expect(workshopSource).toContain("Siguiente paso recomendado");
    expect(workshopSource).toContain("Cambiar a otro estado");
    expect(workshopSource).toContain("Guardar cambio");
    expect(workshopSource).toContain("Enviar al cliente");
    expect(workshopSource).toContain(
      "disabled={selectedStatus === detail.order.status}",
    );
    expect(workshopSource).not.toContain(
      'value={detail.order.status} onChange={(event) => change(event.target.value)}',
    );
    expect(workshopSource).toContain('"received", "inspection", "in_progress", "waiting_parts", "quality_check"');
    expect(workshopSource).not.toContain('inspection: "diagnosis"');
  });

  it("captura piezas en MXN y las administra como tarjetas de servicio", () => {
    expect(workshopSource).toContain("parseMxnToCents(line.price)");
    expect(workshopSource).toContain("Precio unitario (MXN)");
    expect(workshopSource).toContain('inputMode="decimal"');
    expect(workshopSource).not.toContain("Precio centavos");
    expect(workshopSource).toContain('className="selected-services order-parts-list"');
    expect(workshopSource).toContain("Editar pieza");
    expect(workshopSource).toContain("Marcar instalada");
    expect(workshopSource).toContain("removePart(part)");
  });

  it("usa iconos propios para cada estado del progreso", () => {
    for (const icon of [
      "receive-.svg",
      "dagnostico.svg",
      "approve.svg",
      "reparacion.svg",
      "pickup.svg",
      "entregado.svg",
    ]) {
      expect(uiSource).toContain(icon);
    }
    expect(styles).toContain("mask: var(--step-icon) center / contain no-repeat");
  });
});
