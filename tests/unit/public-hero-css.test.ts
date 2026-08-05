import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("artifacts/web/style.css", "utf8");

// Cuenta apariciones de una regla base (sin indentación, es decir fuera de
// cualquier @media), para distinguir "una sola definición base" de las
// variantes legítimas dentro de media queries.
function countBaseRuleOccurrences(selectorPattern: string): number {
  const regex = new RegExp(`^${selectorPattern}\\s*\\{`, "gm");
  return (styles.match(regex) ?? []).length;
}

describe("consolidación de .public-hero / .public-page-hero (sin regresión visual)", () => {
  it("solo existe una definición base (fuera de @media) de .public-hero", () => {
    expect(countBaseRuleOccurrences("\\.public-hero")).toBe(1);
  });

  it("solo existe una definición base de .public-hero h1", () => {
    expect(countBaseRuleOccurrences("\\.public-hero h1")).toBe(1);
  });

  it(".public-page-hero y .public-page-hero h1 ya no dependen de un selector compartido con .public-hero", () => {
    expect(styles).not.toMatch(/\.public-hero h1,\s*\n?\.public-page-hero h1/);
    expect(styles).toContain(
      ".public-page-hero h1 { max-width: 850px; margin: 0; font-size: clamp(3rem, 12vw, 6rem); line-height: .91; letter-spacing: -.07em; }",
    );
  });

  it("eliminó el bloque desktop duplicado y muerto de .public-hero (min-width:1024px)", () => {
    // Debe quedar exactamente un .public-hero dentro de @media (min-width: 1024px),
    // el que fija grid-template-columns/min-height reales (antes había dos).
    const desktopHeroRules = styles.match(/ {2}\.public-hero \{ grid-template-columns:/g) ?? [];
    expect(desktopHeroRules).toHaveLength(1);
    expect(styles).not.toContain(
      ".public-hero { grid-template-columns: minmax(0, 1.05fr) minmax(480px, .95fr); min-height: 720px; }",
    );
  });

  it("preserva exactamente los valores computados base (display, gap, min-height con svh, padding, fondo)", () => {
    expect(styles).toMatch(
      /\.public-hero \{[^}]*display: grid;[^}]*align-items: center;[^}]*gap: 24px;[^}]*min-height: min\(740px, calc\(100svh - 88px\)\);[^}]*padding: 64px 18px 110px;/,
    );
  });

  it("preserva exactamente los valores computados base de .public-hero h1 (margin, max-width, font-size, text-stroke)", () => {
    expect(styles).toMatch(
      /\.public-hero h1 \{[^}]*margin: 0;[^}]*max-width: none;[^}]*color: transparent;[^}]*font-size: clamp\(4\.4rem, 16vw, 10rem\);[^}]*-webkit-text-stroke: 2px var\(--mb-color-white\);/,
    );
  });

  it("la tipografía compartida (letter-spacing, line-height, uppercase) de .public-hero h1 sigue viniendo del bloque de marca sin duplicarse", () => {
    expect(styles).toMatch(
      /\.public-hero h1,\s*\n\.client-wallet h2,/,
    );
    expect(styles).toContain("letter-spacing: -.035em;\n  line-height: .92;");
  });

  it("conserva intactas las tres variantes responsivas legítimas (desktop columnas, desktop padding, móvil dvh)", () => {
    expect(styles).toContain(
      ".public-hero { grid-template-columns: 1.3fr .7fr; min-height: 620px; }",
    );
    expect(styles).toContain(".public-hero { padding: 90px 7% 110px; }");
    expect(styles).toContain("min-height: max(520px, calc(100dvh - 80px));");
    expect(styles).toContain(
      ".public-hero h1 { font-size: clamp(3.75rem, 16vw, 5.25rem); line-height: .9; -webkit-text-stroke-width: 1px; }",
    );
  });

  it("la definición base no usa overflow-x ni una altura fija — min-height depende de svh, no de un valor rígido", () => {
    const baseRule = styles.match(/^\.public-hero \{[\s\S]*?\n\}/m)?.[0] ?? "";
    expect(baseRule).not.toMatch(/overflow-x:/);
    expect(baseRule).toMatch(/min-height: min\(740px, calc\(100svh - 88px\)\)/);
    expect(baseRule).not.toMatch(/min-height: \d+px;/);
  });
});
