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
const workshopFlowSource = readFileSync(
  "artifacts/web/components/WorkshopRequestFlow.tsx",
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

  it("genera enlaces y delega la preselección al catálogo real", () => {
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
    expect(resolveRequestedWorkshopService("?servicio=Servicio%20inventado")).toBe("Servicio inventado");
    expect(
      resolveRequestedWorkshopService("?servicio=Bike%20wash%20"),
    ).toBe("Bike wash");
    expect(workshopFlowSource).toContain('match?.name ?? "Otro / necesito diagnóstico"');
  });

  it("renderiza tarjetas accesibles solamente dentro de WorkshopInfo", () => {
    expect(publicPagesSource.match(/className="service-card"/g)).toHaveLength(1);
    expect(publicPagesSource).toContain(
      'eyebrow="SERVICIO PROFESIONAL" title="TODO LO QUE TU BICI NECESITA"',
    );
    expect(publicPagesSource).toContain(
      "aria-label={`Solicitar servicio: ${service}`}",
    );
    expect(workshopRequestSource).toContain("WorkshopRequestFlow");
    expect(workshopFlowSource).toContain("getWorkshopCatalog()");
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
    expect(styles).not.toContain(".service-card:nth-child(3n + 2)");
    expect(styles).toMatch(/\.service-card:hover\s*\{[^}]*background:\s*#f51168/);
    expect(styles).toMatch(/\.service-card:focus-visible,\s*\.service-card:active/);
  });

  it("presenta Mi Tarjeta con un hero fotográfico como Taller", () => {
    expect(publicPagesSource).toContain('className="loyalty-photo-hero"');
    expect(publicPagesSource).toContain('title="CADA RODADA CUENTA"');
    expect(styles).toContain("--brand-photo-workshop-hero: url(\"../../recursos/webp/ASN06722.webp\")");
    expect(styles).toContain("--brand-photo-loyalty-hero: url(\"../../recursos/webp/ASN02947.webp\")");
    expect(styles).toContain("--brand-photo-workshop-card: url(\"../../recursos/webp/1234.webp\")");
    expect(styles).toContain("--brand-photo-loyalty-card: url(\"../../recursos/webp/ASN03155.webp\")");
    expect(styles).toContain("--brand-photo-community: url(\"../../recursos/webp/13.webp\")");
  });
});
