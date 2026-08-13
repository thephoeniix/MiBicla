import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWhatsappMessage, buildWhatsappUrl } from "../../artifacts/api/src/services/public-links.service";
import { resolvePublicRoute } from "../../artifacts/web/lib/public-routes";

const service = readFileSync("artifacts/api/src/services/public-links.service.ts", "utf8");
const workshop = readFileSync("artifacts/api/src/services/workshop.service.ts", "utf8");
const form = readFileSync("artifacts/web/components/WorkshopRequestFlow.tsx", "utf8");

describe("enlaces públicos universales", () => {
  it("usa códigos Base64URL de 16 caracteres y una sola ruta", () => {
    expect(service).toContain('.digest("base64url").slice(0, 16)');
    expect(service).toContain("sha256(code)");
    expect(resolvePublicRoute("/l/AbCdEf0123456789")).toEqual({ route: "public-link", token: "AbCdEf0123456789" });
  });
  it("construye WhatsApp con URLSearchParams y conserva corto el enlace del texto", () => {
    const link = "https://mibiclaqro.com/l/AbCdEf0123456789";
    const message = buildWhatsappMessage("Consulta: {url}", { url: link });
    const url = new URL(buildWhatsappUrl("+52 442 123 4567", message));
    expect(url.hostname).toBe("wa.me");
    expect(url.searchParams.get("text")).toBe(`Consulta: ${link}`);
    expect(url.searchParams.get("text")).not.toMatch(/[a-f0-9]{64}/);
  });
  it("preparar WhatsApp reutiliza y regenerar es explícito", () => {
    expect(workshop).toContain("token = await this.getOrCreateActiveLink(orderId)");
    expect(workshop).toContain('regenerateLink("workshop_tracking"');
  });
  it("GET no consume enlaces sensibles", () => {
    const routes = readFileSync("artifacts/api/src/routes/public-links.ts", "utf8");
    expect(routes.slice(routes.indexOf('router.get("/links/:code"'), routes.indexOf('router.post("/links/:code/password"'))).not.toContain("links.consume");
    expect(routes.slice(routes.indexOf('router.post("/links/:code/password"'))).toContain("links.consume(result.link.id)");
  });
  it("el flujo compartido cubre cinco pasos y 320px", () => {
    expect(form).toContain('"Tus datos", "Tu bicicleta", "Servicio", "Fecha y horario", "Revisión y envío"');
    const css = readFileSync("artifacts/web/style.css", "utf8");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("min-height: 44px");
  });
});
