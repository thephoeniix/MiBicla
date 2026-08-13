import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("artifacts/web/index.html", "utf8");
const app = readFileSync("artifacts/web/src.tsx", "utf8");

describe("preloader de marca", () => {
  it("muestra el logo antes de montar React y sale cuando la app está lista", () => {
    expect(html).toContain('id="brand-preloader"');
    expect(html).toContain('src="/pink-simple.png"');
    expect(html).toContain('aria-label="Cargando Mi Bicla"');
    expect(app).toContain('new Event("mb:app-ready")');
  });

  it("evita retrasos repetidos y respeta movimiento reducido", () => {
    expect(html).toContain('sessionStorage.getItem("mb_preloader_seen")');
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("setTimeout(finish, 5000)");
  });
});
