import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicPages = readFileSync("artifacts/web/pages/public/PublicPages.tsx", "utf8");
const publicShell = readFileSync("artifacts/web/components/public/PublicShell.tsx", "utf8");
const portal = readFileSync("artifacts/web/pages/customer/CustomerPortal.tsx", "utf8");

describe("acceso al portal del cliente", () => {
  it("envía taller y fidelidad al portal autenticado sin solicitar token", () => {
    expect(publicPages).toContain('kind === "workshop" ? "/mi/taller" : "/mi/tarjeta"');
    expect(publicShell).toContain('href="/mi/taller"');
    expect(publicShell).toContain('href="/mi/tarjeta"');
    expect(publicShell).not.toContain("TokenAccessDialog");
    expect(publicShell).not.toContain("public:token-dialog");
  });

  it("renderiza las cinco áreas con datos autenticados y sin token público", () => {
    expect(portal).toContain('location.pathname === "/mi/tarjeta"');
    expect(portal).toContain('location.pathname === "/mi/bicicletas"');
    expect(portal).toContain('"/mi/taller"');
    expect(portal).toContain('"/mi/orden"');
    expect(portal).toContain('location.pathname === "/mi/perfil"');
    expect(portal).toContain('"/mi/ordenes"');
    expect(portal).not.toContain("extractPublicToken");
    expect(portal).toContain(">Inicio</a>");
    expect(portal).toContain(">Mi tarjeta</a>");
    expect(portal).toContain('"Órdenes"');
    expect(portal).toContain('"Bicicletas"');
    expect(portal).toContain(">Mi perfil</a>");
  });

  it("reserva la navegación inferior para /mi y usa cinco accesos útiles", () => {
    expect(publicShell).not.toContain('className="public-bottom-nav"');
    expect(portal).toContain('["/mi/bicicletas", "Bicicletas"');
    expect(portal).toContain('["/mi/eventos", "Eventos"');
    expect(portal).toContain('["/mi/ordenes", "Órdenes"');
    expect(portal).toContain('["/mi/productos", "Productos"');
    expect(portal).toContain("<MoreIcon />");
    expect(portal).toContain('aria-label="Más opciones del cliente"');
  });

  it("usa las imágenes gio como lenguaje visual del portal", () => {
    const styles = readFileSync("artifacts/web/style.css", "utf8");
    expect(styles).toContain('../../recursos/webp/gio1.webp');
    expect(styles).toContain('../../recursos/gio2.jpeg');
    expect(styles).toContain('../../recursos/gio3.jpeg');
    expect(styles).toContain("grid-template-columns: repeat(5, 1fr)");
  });

  it("usa la nueva vista móvil y conserva bicicletas como puntos", () => {
    const styles = readFileSync("artifacts/web/style.css", "utf8");
    expect(portal).toContain("BicycleVisual");
    expect(portal).toContain("Bicicleta Mi Bicla");
    expect(portal).not.toContain("Foto de la bicicleta (enlace)");
    expect(portal).toContain("customer-order-tabs");
    expect(portal).toContain("customer-previous-orders");
    expect(portal).toContain("customer-profile-identity");
    expect(portal).toContain("customer-profile-links");
    expect(portal).toContain("client-member-card");
    expect(portal).toContain("client-points-card");
    expect(portal).toContain('src="/pink-simple.png"');
    expect(styles).toContain("repeat(10, minmax(0, 1fr))");
    expect(styles).toContain(".customer-bicycle-visual");
    expect(styles).toContain("Contraste estable del portal");
    expect(styles).toContain(".ui-card.customer-order-detail");
  });

  it("restaura el QR escaneable y elimina el código visual de fidelidad", () => {
    expect(portal).toContain("createMyCardLink");
    expect(portal).toContain("QRCode.toDataURL");
    expect(portal).toContain("Ver mi QR");
    expect(portal).not.toContain("Código de fidelidad");
    expect(portal).not.toContain("memberCode");
  });

  it("muestra solicitudes con estado antes de que exista una orden", () => {
    expect(portal).toContain("requestStatusText");
    expect(portal).toContain("ANTES DE LA ORDEN");
    expect(portal).toContain("Tu solicitud aparece arriba con su estado");
  });

  it("conserva los accesos públicos por enlace en sus rutas existentes", () => {
    const routes = readFileSync("artifacts/web/lib/public-routes.ts", "utf8");
    expect(routes).toContain('pathname.match(/^\\/taller\\/([^/]+)$/)');
    expect(routes).toContain('pathname.match(/^\\/c\\/([^/]+)$/)');
  });
});
