import { expect, test } from "@playwright/test";

test("loads and navigates without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Mi Bicla Querétaro/);
  await expect(page.getByRole("heading", { level: 1, name: "Tu bicicleta. Tu aventura." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const brands = page.getByRole("region", { name: "Marcas disponibles" });
  await brands.scrollIntoViewIfNeeded();
  await expect(brands.locator(".brand-carousel-group")).toHaveCount(2);
  await expect.poll(() => brands.locator(".brand-carousel-track").evaluate((element) => getComputedStyle(element).animationName)).toBe("brand-marquee");

  const contactHeading = page.getByRole("heading", { level: 2, name: "Mi Bicla siempre cerca." });
  await contactHeading.scrollIntoViewIfNeeded();
  await expect(contactHeading).toBeVisible();
  await expect(page.getByText("Lunes a viernes: 12:00 PM a 8:00 PM")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar contacto" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("mi-bicla.vcf");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú principal" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Mi Tarjeta", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Contacto", exact: true })).toBeVisible();
    await expect(menu.getByRole("heading", { name: "Explorar" })).toBeVisible();
    await expect(menu.getByRole("heading", { name: "Tu cuenta" })).toBeVisible();
    await expect(menu.getByRole("heading", { name: "Ayuda" })).toBeVisible();
    await menu.getByRole("link", { name: "Taller", exact: true }).click();
  } else {
    const navigation = page.getByRole("navigation", { name: "Navegación pública" });
    await expect(navigation.getByRole("link", { name: "Mi Tarjeta", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Contacto", exact: true })).toBeVisible();
    await navigation
      .getByRole("link", { name: "Taller", exact: true })
      .click();
  }

  await expect(page).toHaveURL(/\/taller$/);
  await expect(page.getByRole("heading", { level: 1, name: "TU BICI MERECE LA MEJOR RUTA" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("renders configurable deposit tabs without horizontal overflow", async ({ page }) => {
  await page.route("**/api/public/depositos", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      items: [
        { id: "test-one", displayName: "Cuenta principal", bankName: "Banco Uno", accountHolder: "Persona Uno", cardNumber: "1111222233334444", clabe: "111122223333444455", referenceText: "Nombre del cliente", instructions: "Conserva tu comprobante.", whatsappNumber: "524428306394", whatsappTemplate: "Comprobante para {banco}" },
        { id: "test-two", displayName: "Cuenta alterna", bankName: "Banco Dos", accountHolder: "Persona Dos", accountNumber: "5555666677778888", referenceText: "Número de pedido", instructions: "Envía tu comprobante.", whatsappNumber: "524428306394", whatsappTemplate: "Comprobante para {banco}" },
      ],
    }),
  }));
  await page.goto("/depositos");

  await expect(page.getByRole("heading", { level: 1, name: "Realiza tu depósito." })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toContainText("Persona Uno");
  await page.getByRole("tab", { name: /Cuenta alterna/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Persona Dos");
  await expect(page.getByText("Tu comprobante nos ayuda a confirmar el pago.")).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("renders products and events without mobile overflow", async ({ page }) => {
  const product = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Casco Trail",
    description: "Protección para rutas de montaña.",
    category: "Protección",
    imageUrl: null,
    priceCents: 189900,
    discountPercent: 20,
    sizes: ["M", "L"],
    colors: ["Negro", "Rosa"],
    availability: "available",
    isPublished: true,
  };
  await page.route("**/api/public/commerce/products**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify([product]) }));
  await page.route("**/api/public/commerce/events**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify([{ id: "22222222-2222-4222-8222-222222222222", title: "Rodada La Cañada", description: "Punto de encuentro Mi Bicla.", category: "Ruta", location: "La Cañada, Querétaro", mapUrl: null, startsAt: "2030-08-20T14:00:00.000Z", endsAt: "2030-08-20T18:00:00.000Z", imageUrl: null, isPublished: true, products: [product] }]) }));

  await page.goto("/productos");
  await expect(page.getByRole("heading", { level: 1, name: "Productos Mi Bicla" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Casco Trail" })).toBeVisible();
  await expect(page.getByText("-20%")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.goto("/eventos");
  await expect(page.getByRole("heading", { level: 1, name: "Eventos y rodadas" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Rodada La Cañada" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("keeps customer and public event tickets visually aligned", async ({ page }) => {
  const event = {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Vuelta Colón",
    description: "Competencia de ruta en Colón.",
    category: "Ruta",
    location: "Colón, Querétaro",
    mapUrl: "https://maps.google.com/?q=Colon",
    startsAt: "2030-08-16T12:00:00.000Z",
    endsAt: "2030-08-16T18:00:00.000Z",
    imageUrl: null,
    infoUrl: null,
    isPublished: true,
    products: [],
  };
  await page.route("**/api/customer/session", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ customer: { id: "44444444-4444-4444-8444-444444444444", name: "Cliente Mi Bicla", firstName: "Cliente", phone: "4420000000", accountStatus: "active" }, csrfToken: "test-csrf-token" }) }));
  await page.route("**/api/customer/commerce/requests", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/public/commerce/products**", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/public/commerce/events**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify([event]) }));
  await page.route("**/api/public/business", (route) => route.fulfill({ contentType: "application/json", body: "{}" }));

  await page.goto("/mi/eventos");
  await expect(page.getByRole("heading", { level: 2, name: "Vuelta Colón" })).toBeVisible();
  for (const label of ["Fecha", "Horario", "Lugar"])
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByText("MI BICLA ASISTE", { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
