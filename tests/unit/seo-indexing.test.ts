import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SEO e identidad inicial", () => {
  const html = readFileSync("artifacts/web/index.html", "utf8");
  const robots = readFileSync("artifacts/web/public/robots.txt", "utf8");
  const sitemap = readFileSync("artifacts/web/public/sitemap.xml", "utf8");
  const shell = readFileSync("artifacts/web/components/public/PublicShell.tsx", "utf8");

  it("declara logo simple pink, canonical y metadata rastreable", () => {
    expect(html).toContain('rel="icon" type="image/png" href="/pink-simple.png"');
    expect(html).toContain('rel="canonical" href="https://mibiclaqro.com/"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('type="application/ld+json"');
    expect(shell).toContain('<BrandLogo variant="symbol" color="pink" />');
  });

  it("publica sitemap y excluye áreas privadas del rastreo", () => {
    expect(robots).toContain("Sitemap: https://mibiclaqro.com/sitemap.xml");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /mi");
    expect(sitemap).toContain("https://mibiclaqro.com/productos");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("mibiclaqro.com/mi");
  });
});
