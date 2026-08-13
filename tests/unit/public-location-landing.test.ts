import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHORIZED_BRANDS } from "../../artifacts/web/lib/public-content";
import {
  businessContactVcard,
  configuredWhatsappUrl,
  MI_BICLA_CONTACT,
  MI_BICLA_MAPS_URL,
  openingHoursEntries,
  whatsappContactUrl,
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
const brandCarouselSource = readFileSync(
  "artifacts/web/components/public/BrandCarousel.tsx",
  "utf8",
);
const brandSources = JSON.parse(
  readFileSync("artifacts/web/public/brands/sources.json", "utf8"),
) as Array<{ name: string; file: string; format: string }>;

describe("ubicación y contacto públicos", () => {
  it("mantiene fijo el destino de Maps por ahora", () => {
    expect(MI_BICLA_MAPS_URL).toContain(
      "google.com/maps/place/Mi+Bicla/@20.6064534,-100.3317012",
    );
  });

  it("construye WhatsApp desde la configuración y conserva un respaldo real", () => {
    expect(configuredWhatsappUrl("+52 000 000 0000")).toBe(
      "https://wa.me/520000000000",
    );
    expect(configuredWhatsappUrl("123")).toBeNull();
    expect(configuredWhatsappUrl()).toBeNull();
    expect(publicPagesSource).toContain(
      "business?.primaryWhatsapp || MI_BICLA_CONTACT.primaryWhatsapp",
    );
    expect(whatsappContactUrl(MI_BICLA_CONTACT.primaryWhatsapp)).toContain(
      "wa.me/524428306394?text=",
    );
  });

  it("protege y nombra los enlaces externos", () => {
    expect(publicPagesSource).toContain('rel="noopener noreferrer"');
    expect(publicPagesSource).toContain(
      "Cómo llegar a la ubicación de Mi Bicla",
    );
    expect(publicPagesSource).toContain("Contactar al WhatsApp principal de Mi Bicla");
    expect(publicPagesSource).toContain("Visitar Instagram de Mi Bicla");
  });

  it("mantiene dirección y Cómo llegar aunque la configuración no cargue", () => {
    expect(publicPagesSource).toContain("business?.address || MI_BICLA_CONTACT.address");
    expect(publicPagesSource).toContain("href={MI_BICLA_MAPS_URL}");
  });

  it("usa el teléfono solo como acción directa del hero", () => {
    expect(publicPagesSource).not.toContain("public-contact-phone");
    expect(publicPagesSource).toContain('href={`tel:');
    expect(publicPagesSource).toContain("Llamar ahora");
    expect(publicPagesSource).toContain("<LocationIcon />");
  });

  it("openingHoursEntries solo devuelve datos reales — presente, vacío y ausente", () => {
    expect(openingHoursEntries({ "Lunes – viernes": "12:00–8:00 p.m." })).toEqual([
      ["Lunes – viernes", "12:00–8:00 p.m."],
    ]);
    expect(openingHoursEntries({})).toEqual([]);
    expect(openingHoursEntries(undefined)).toEqual([]);
  });

  it("usa horarios editables con el horario confirmado como respaldo", () => {
    expect(publicPagesSource).toContain("openingHoursEntries(business?.openingHours)");
    expect(publicPagesSource).toContain('[["Lunes a viernes", MI_BICLA_CONTACT.weekdayHours]]');
    expect(MI_BICLA_CONTACT.weekdayHours).toBe("12:00 PM a 8:00 PM");
    expect(publicPagesSource).not.toContain("Sábado");
    expect(publicPagesSource).not.toContain("Domingo");
  });

  it("Instagram y Facebook usan configuración con respaldo confirmado", () => {
    expect(publicPagesSource).toContain("business?.social?.instagram");
    expect(publicPagesSource).not.toContain("business?.instagram");
    expect(publicPagesSource).toContain("business?.social?.facebook");
    expect(MI_BICLA_CONTACT.instagram).toContain("instagram.com/mibiclaqro");
    expect(MI_BICLA_CONTACT.facebook).toContain("facebook.com/MiBiclaQueretaro");
  });

  it("genera un VCF descargable con los datos públicos", () => {
    const vcard = businessContactVcard({
      name: MI_BICLA_CONTACT.name,
      primaryWhatsapp: MI_BICLA_CONTACT.primaryWhatsapp,
      secondaryWhatsapp: MI_BICLA_CONTACT.secondaryWhatsapp,
      email: MI_BICLA_CONTACT.email,
      address: MI_BICLA_CONTACT.address,
    });
    expect(vcard).toContain("BEGIN:VCARD\r\nVERSION:3.0");
    expect(vcard).toContain("TEL;TYPE=CELL:+524428306394");
    expect(vcard).toContain("TEL;TYPE=CELL:+524427496410");
    expect(vcard).toContain("EMAIL;TYPE=INTERNET:mibiclaqro@gmail.com");
    expect(publicPagesSource).toContain('link.download = "mi-bicla.vcf"');
  });

  it("usa la fotografía y el layout responsive de contacto", () => {
    expect(publicPagesSource).toContain('recursos/webp/car3.webp');
    expect(publicPagesSource).toContain("public-contact-layout");
    expect(publicPagesSource).toContain("Pasión que");
    expect(styles).toContain(".public-contact-visual");
    expect(styles).toMatch(/\.public-contact-layout\s*\{[^}]*display:\s*grid/);
    expect(styles).toMatch(/@media \(min-width: 1024px\)[\s\S]*\.public-contact-layout\s*\{[^}]*grid-template-columns/);
  });

  it("mantiene el sitio web editable para el contacto descargable", () => {
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

  it("mantiene logos contenidos sobre una superficie clara", () => {
    expect(styles).toMatch(
      /\.brand-carousel-card img[^}]*object-fit:\s*contain/,
    );
    expect(styles).toMatch(/\.brand-carousel\s*\{[^}]*background:\s*#101014/);
    expect(styles).toMatch(/\.brand-carousel-card\s*\{[^}]*background:\s*#fff/);
    expect(styles).not.toMatch(
      /\.brand-carousel-card\s*\{[^}]*background:\s*(?:#000|black|var\(--mb-color-black\))/,
    );
  });

  it("desplaza dos grupos en bucle y respeta movimiento reducido", () => {
    expect(brandCarouselSource).toContain("[false, true].map");
    expect(brandCarouselSource).toContain("aria-hidden={duplicate || undefined}");
    expect(brandCarouselSource).not.toContain("brand-carousel-controls");
    expect(styles).toContain("animation: brand-marquee 38s linear infinite");
    expect(styles).toContain("animation-play-state: paused");
    expect(styles).toContain("@keyframes brand-marquee");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.brand-carousel-track\s*\{[^}]*animation:\s*none/);
  });

  it("centra las tarjetas editoriales y conserva targets accesibles", () => {
    const featureRule = styles.match(/\.brand-feature\s*\{([^}]*)\}/)?.[1];
    expect(featureRule).toContain("display: flex");
    expect(featureRule).toContain("flex-direction: column");
    expect(featureRule).toContain("align-items: center");
    expect(featureRule).toContain("justify-content: center");
    expect(featureRule).toContain("text-align: center");
    expect(styles).toContain(".brand-feature:focus-visible");
    expect(styles).toMatch(/\.brand-feature:hover::before\s*\{[^}]*opacity:\s*1/);
    expect(styles).toMatch(/\.brand-feature::before[^}]*opacity:\s*0;[^}]*rgb\(245 17 104/);
    expect(styles).toMatch(/\.brand-feature--pink\s*\{[^}]*linear-gradient\(0deg, rgb\(0 0 0/);
  });

  it("reemplaza acciones rápidas por seis tarjetas principales", () => {
    for (const title of ["TALLER MECÁNICO", "MI TARJETA", "MIS BICICLETAS", "EVENTOS", "PRODUCTOS", "MÉTODOS DE PAGO"])
      expect(publicPagesSource).toContain(`title="${title}"`);
    expect(publicPagesSource).not.toContain('className="quick-actions"');
    expect(styles).not.toContain(".quick-actions");
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
