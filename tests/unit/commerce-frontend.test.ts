import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discountedPriceCents, formatMxn, mxnToCents } from "../../artifacts/web/lib/commerce";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("frontend de comercio", () => {
  it("convierte importes administrativos de MXN a centavos", () => {
    expect(mxnToCents("1299.90")).toBe(129990);
    expect(mxnToCents("")).toBeNull();
    expect(mxnToCents("no es un precio")).toBeNull();
    expect(formatMxn(null)).toBe("Solicita cotización");
    expect(discountedPriceCents(189900, 20)).toBe(151920);
    expect(discountedPriceCents(null, 20)).toBeNull();
  });

  it("usa únicamente los endpoints de comercio definidos", () => {
    const client = source("../../artifacts/web/lib/commerce.ts");
    expect(client).toContain("/api/public/commerce/products?search=");
    expect(client).toContain("/api/public/commerce/events?category=");
    expect(client).toContain('"/api/customer/commerce/requests"');
    expect(client).toContain("customerFetch<CommerceRequest>");
    expect(client).toMatch(/customerFetch<CommerceRequest>[\s\S]*?true,/);
    expect(client).toContain('"/api/admin/commerce/products"');
    expect(client).toContain('"/api/admin/commerce/events"');
    expect(client).toContain('"/api/admin/commerce/requests"');
    expect(client).toContain("/api/admin/commerce/products/${id}");
    expect(client).toContain("/api/admin/commerce/events/${id}/products");
    expect(client).toContain("/api/admin/commerce/requests/${id}");
    expect(client).not.toContain('method: "DELETE"');
  });

  it("protege las llamadas a la acción públicas con inicio de sesión", () => {
    const publicPage = source("../../artifacts/web/pages/public/Commerce.tsx");
    expect(publicPage).toContain("/iniciar-sesion?next=");
    expect(publicPage).not.toContain("/api/");
  });

  it("presenta eventos como boletos en público y en el portal", () => {
    const publicPage = source("../../artifacts/web/pages/public/Commerce.tsx");
    const customer = source("../../artifacts/web/pages/customer/CustomerCommerce.tsx");
    const css = source("../../artifacts/web/style.css");
    expect(publicPage).toContain('className="commerce-event-card event-ticket"');
    expect(customer).toContain('className="customer-event-card event-ticket"');
    expect(customer).toContain("MI BICLA ASISTE");
    expect(customer).toContain('className="event-details"');
    expect(customer).toContain("Ver en Google Maps");
    expect(css).toContain(".event-ticket-date");
    expect(css).toContain("border-top: 2px dashed");
  });

  it("presenta productos como etiquetas de equipo distintas a los boletos", () => {
    const publicPage = source("../../artifacts/web/pages/public/Commerce.tsx");
    const customer = source("../../artifacts/web/pages/customer/CustomerCommerce.tsx");
    const css = source("../../artifacts/web/style.css");
    expect(publicPage).toContain('className="commerce-card product-gear-card"');
    expect(customer).toContain('className="customer-commerce-card product-gear-card"');
    expect(css).toContain(".product-gear-media");
    expect(css).toContain("border-radius: 6px 22px 6px 22px");
    expect(publicPage).toContain("product-discount-sticker");
    expect(css).toContain(".product-discount-sticker");
  });

  it("incluye producto personalizado y asociación de productos a eventos", () => {
    const customer = source(
      "../../artifacts/web/pages/customer/CustomerCommerce.tsx",
    );
    const admin = source("../../artifacts/web/pages/admin/CommerceAdmin.tsx");
    expect(customer).toContain("customProductName");
    expect(customer).toContain('value="shipping"');
    expect(customer).toContain("El costo de envío lo paga el cliente");
    expect(customer).toContain("Selecciona una talla");
    expect(customer).toContain("Contactar a Mi Bicla por WhatsApp");
    expect(admin).toContain("setAdminEventProducts(saved.id, form.productIds)");
    expect(admin).toContain("mxnToCents(form.price)");
    expect(admin).toContain("uploadAdminImage(file)");
    expect(admin).toContain("Instagram, Facebook o web del evento");
    expect(admin).toContain("Buscar ubicación en Google Maps");
    expect(admin).toContain("PRODUCT_COLORS.map");
    expect(admin).toContain("Responder al cliente por WhatsApp");
    expect(source("../../artifacts/web/pages/public/Commerce.tsx")).toContain(
      "Más información",
    );
    expect(source("../../artifacts/web/pages/public/Commerce.tsx")).toContain(
      "Pedir producto para este evento",
    );
  });

  it("mantiene grids seguros y FormDialog de pantalla completa en móvil", () => {
    const css = source("../../artifacts/web/style.css");
    expect(css).toContain(".commerce-grid");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.ui-form-dialog \{[\s\S]*?height: 100dvh/,
    );
  });
});
