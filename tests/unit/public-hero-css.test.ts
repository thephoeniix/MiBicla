import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("artifacts/web/style.css", "utf8");
const html = readFileSync("artifacts/web/index.html", "utf8");
const source = readFileSync("artifacts/web/pages/public/PublicPages.tsx", "utf8");

function countBaseRules(selector: string): number {
  return (styles.match(new RegExp(`^${selector}\\s*\\{`, "gm")) ?? []).length;
}

describe("identidad editorial del hero público", () => {
  it("mantiene una sola definición base del hero y su titular", () => {
    expect(countBaseRules("\\.public-hero")).toBe(1);
    expect(countBaseRules("\\.public-hero h1")).toBe(1);
  });

  it("usa la fotografía, degradado y escala de la referencia", () => {
    expect(styles).toMatch(/\.public-hero \{[^}]*min-height: min\(850px, calc\(100svh - 76px\)\);/);
    expect(styles).toMatch(/\.public-hero \{[^}]*border-radius: 0/);
    expect(styles).toContain('url("../../recursos/webp/13.webp")');
    expect(styles).toMatch(/\.public-hero h1 \{[^}]*color: #f8f8fa;[^}]*font-size: clamp\(4\.8rem, 9vw, 8\.6rem\);[^}]*-webkit-text-stroke: 0;/);
  });

  it("carga Manrope y Barlow Condensed sin cambiar la tipografía administrativa", () => {
    expect(html).toContain("family=Barlow+Condensed");
    expect(html).toContain("family=Manrope");
    expect(styles).toContain(".public-shell {");
    expect(styles).toContain("font-family: Manrope, var(--mb-font-sans)");
  });

  it("presenta el mensaje y las acciones de la página informativa", () => {
    expect(source).toContain("Tu bicicleta.");
    expect(source).toContain("Tu aventura.");
    expect(source).toContain("Hablar por WhatsApp");
    expect(source).toContain("Llamar ahora");
  });

  it("conserva variantes responsive sin fijar height", () => {
    const base = styles.match(/^\.public-hero \{[\s\S]*?\n\}/m)?.[0] ?? "";
    expect(base).not.toMatch(/(?:^|\s)height:/);
    expect(styles).toContain("@media (max-width: 900px)");
    expect(styles).toContain("@media (max-width: 600px)");
    expect(styles).toContain("grid-template-columns: 1fr 1fr");
  });
});
