import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHORIZED_BRANDS } from "../../artifacts/web/lib/public-content";
import {
  configuredWhatsappUrl,
  MI_BICLA_MAPS_URL,
  openingHoursEntries,
} from "../../artifacts/web/lib/public-links";

const publicPagesSource = readFileSync(
  "artifacts/web/pages/public/PublicPages.tsx",
  "utf8",
);
const styles = readFileSync("artifacts/web/style.css", "utf8");
const publicShellSource = readFileSync(
  "artifacts/web/components/public/PublicShell.tsx",
  "utf8",
);
const brandSources = JSON.parse(
  readFileSync("artifacts/web/public/brands/sources.json", "utf8"),
) as Array<{ name: string; file: string; format: string }>;

describe("ubicación y contacto públicos", () => {
  it("mantiene fijo el destino de Maps por ahora", () => {
    expect(MI_BICLA_MAPS_URL).toContain(
      "google.com/maps/place/Mi+Bicla/@20.606104,-100.3349228",
    );
  });

  it("construye WhatsApp únicamente desde la configuración pública", () => {
    expect(configuredWhatsappUrl("+52 000 000 0000")).toBe(
      "https://wa.me/520000000000",
    );
    expect(configuredWhatsappUrl("123")).toBeNull();
    expect(configuredWhatsappUrl()).toBeNull();
    expect(publicPagesSource).toContain(
      "configuredWhatsappUrl(business?.primaryWhatsapp)",
    );
  });

  it("protege y nombra los enlaces externos", () => {
    expect(publicPagesSource).toContain('rel="noopener noreferrer"');
    expect(publicPagesSource).toContain(
      "Cómo llegar a la ubicación de Mi Bicla",
    );
    expect(publicPagesSource).toContain("Contactar a Mi Bicla por WhatsApp");
    expect(publicPagesSource).toContain("Visitar Instagram de Mi Bicla");
  });

  it("mantiene Cómo llegar aunque la configuración del negocio no cargue", () => {
    expect(publicPagesSource).toContain(
      "<Card><h3>Ubicación</h3>{business?.address && <p>{business.address}</p>}",
    );
    expect(publicPagesSource).not.toContain(
      "{business?.address && <Card><h3>Ubicación</h3>",
    );
    expect(publicPagesSource).toContain("href={MI_BICLA_MAPS_URL}");
  });

  it("oculta el teléfono como texto plano", () => {
    expect(publicPagesSource).not.toContain("public-contact-phone");
    expect(publicPagesSource).not.toContain('href={`tel:');
    expect(publicPagesSource).toContain("<LocationIcon />");
  });

  it("openingHoursEntries solo devuelve datos reales — presente, vacío y ausente", () => {
    expect(openingHoursEntries({ "Lunes – viernes": "12:00–8:00 p.m." })).toEqual([
      ["Lunes – viernes", "12:00–8:00 p.m."],
    ]);
    expect(openingHoursEntries({})).toEqual([]);
    expect(openingHoursEntries(undefined)).toEqual([]);
  });

  it("los horarios vienen de business.openingHours, con 'Horario no disponible.' como único texto fijo", () => {
    expect(publicPagesSource).toContain("openingHoursEntries(business?.openingHours)");
    expect(publicPagesSource).toContain("Horario no disponible.");
    expect(publicPagesSource).not.toMatch(/<dt>Lunes/);
  });

  it("Instagram usa business.social.instagram (no business.instagram) y no aparece sin configurar", () => {
    expect(publicPagesSource).toContain("business?.social?.instagram");
    expect(publicPagesSource).not.toContain("business?.instagram");
    expect(publicPagesSource).toContain("{instagram &&");
    expect(publicPagesSource).not.toContain("MI_BICLA_INSTAGRAM_URL");
    expect(publicPagesSource).not.toContain(
      "https://www.instagram.com/mibiclaqro/",
    );
  });

  it("Facebook, TikTok y sitio web también leen la forma anidada real de la API", () => {
    expect(publicPagesSource).toContain("business?.social?.facebook");
    expect(publicPagesSource).toContain("business?.social?.tiktok");
    expect(publicPagesSource).toContain("business?.social?.website");
  });
});

describe("carrusel y tarjetas de la landing", () => {
  it("usa una sola instancia del carrusel dentro de la sección principal", () => {
    expect(publicPagesSource.match(/<BrandCarousel /g)).toHaveLength(1);
    expect(
      publicPagesSource.indexOf("<BrandCarousel"),
    ).toBeLessThan(publicPagesSource.indexOf("brand-feature-grid"));
    expect(AUTHORIZED_BRANDS).toHaveLength(13);
  });

  it("mantiene ROCKBROS primero y todos los assets registrados disponibles", () => {
    expect(AUTHORIZED_BRANDS[0]?.name).toBe("ROCKBROS");
    expect(brandSources[0]?.name).toBe("ROCKBROS");
    expect(
      brandSources.map(({ name }) => name),
    ).toEqual(AUTHORIZED_BRANDS.map(({ name }) => name));
    for (const brand of AUTHORIZED_BRANDS) {
      const file = brand.logoUrl.replace("/brands/", "");
      expect(
        existsSync(`artifacts/web/public/brands/${file}`),
        `${brand.name} debe tener un asset local`,
      ).toBe(true);
      expect(brandSources.some((source) => source.file === file)).toBe(true);
    }
  });

  it("usa rutas públicas renovadas para Wahoo y Stan’s", () => {
    expect(
      AUTHORIZED_BRANDS.find(({ name }) => name === "Wahoo")?.logoUrl,
    ).toBe("/brands/wahoo-logo.png");
    expect(
      AUTHORIZED_BRANDS.find(({ name }) => name === "Stan’s")?.logoUrl,
    ).toBe("/brands/stans-logo.png");
  });

  it("mantiene logos contenidos, superficie neutra y desplazamiento local", () => {
    expect(styles).toMatch(
      /\.brand-carousel-card img[^}]*object-fit:\s*contain/,
    );
    expect(styles).toMatch(
      /\.brand-carousel-track\s*\{[^}]*overflow-x:\s*auto/,
    );
    expect(styles).not.toMatch(
      /\.brand-carousel-card\s*\{[^}]*background:\s*(?:#000|black|var\(--mb-color-black\))/,
    );
  });

  it("centra las tarjetas con flex y conserva targets accesibles", () => {
    const featureRule = styles.match(/\.brand-feature\s*\{([^}]*)\}/)?.[1];
    expect(featureRule).toContain("display: flex");
    expect(featureRule).toContain("flex-direction: column");
    expect(featureRule).toContain("align-items: center");
    expect(featureRule).toContain("justify-content: center");
    expect(featureRule).toContain("text-align: center");
    expect(styles).toContain(".brand-feature:focus-visible");
    expect(styles).toMatch(
      /\.brand-carousel-controls button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/,
    );
  });

  it("elimina el estado ficticio, el fondo de cadena y Marcas del header", () => {
    expect(publicPagesSource).not.toContain("hero-status-card");
    expect(publicPagesSource).not.toContain("EJEMPLO · TU BICI ESTÁ");
    expect(styles).not.toContain(".hero-status-card");
    expect(styles).toMatch(
      /\.brand-chain\s*\{[^}]*background:\s*transparent/,
    );
    expect(publicShellSource).not.toContain('["/marcas", "Marcas"');
    expect(publicPagesSource).toContain("export function Brands()");
  });
});
