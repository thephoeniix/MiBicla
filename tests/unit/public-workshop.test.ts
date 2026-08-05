import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  resolveRequestedWorkshopService,
  workshopServiceHref,
  WORKSHOP_SERVICES,
} from "../../artifacts/web/lib/public-content";

const publicPagesSource = readFileSync(
  "artifacts/web/pages/public/PublicPages.tsx",
  "utf8",
);
const workshopRequestSource = readFileSync(
  "artifacts/web/pages/public/WorkshopRequest.tsx",
  "utf8",
);
const styles = readFileSync("artifacts/web/style.css", "utf8");

describe("taller público recuperado", () => {
  it("conserva exactamente los siete servicios históricos", () => {
    expect(WORKSHOP_SERVICES).toEqual([
      "Mantenimiento preventivo",
      "Servicio completo",
      "Reparaciones",
      "Suspensión",
      "Frenos y transmisión",
      "Tubeless",
      "Bike wash",
    ]);
  });

  it("genera enlaces y preselección solo para servicios conocidos", () => {
    for (const service of WORKSHOP_SERVICES) {
      const href = workshopServiceHref(service);
      expect(href).toBe(
        `/taller/solicitud?servicio=${encodeURIComponent(service)}`,
      );
      expect(
        resolveRequestedWorkshopService(
          new URL(href, "https://mibicla.test").search,
        ),
      ).toBe(service);
    }
    expect(
      resolveRequestedWorkshopService("?servicio=Servicio%20inventado"),
    ).toBe("");
    expect(
      resolveRequestedWorkshopService("?servicio=Bike%20wash%20"),
    ).toBe("");
  });

  it("renderiza tarjetas accesibles solamente dentro de WorkshopInfo", () => {
    expect(publicPagesSource.match(/className="service-card"/g)).toHaveLength(1);
    expect(publicPagesSource).toContain(
      'eyebrow="SERVICIO PROFESIONAL" title="TODO LO QUE TU BICI NECESITA"',
    );
    expect(publicPagesSource).toContain(
      "aria-label={`Solicitar servicio: ${service}`}",
    );
    expect(workshopRequestSource).toContain(
      "resolveRequestedWorkshopService",
    );
  });

  it("recupera estilos responsive y de teclado sin overflow forzado", () => {
    expect(styles).toContain(".service-card:focus-visible");
    expect(styles).toMatch(
      /\.service-card\s*\{[^}]*min-height:\s*150px/,
    );
    expect(styles).toMatch(
      /\.service-grid h3\s*\{[^}]*overflow-wrap:\s*anywhere/,
    );
    expect(styles).not.toMatch(
      /\.service-card\s*\{[^}]*overflow-x:/,
    );
  });
});
