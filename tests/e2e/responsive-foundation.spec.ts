import { expect, test, type Page } from "@playwright/test";

const viewports = [
  [320, 568], [360, 800], [375, 667], [390, 844], [430, 932],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900],
] as const;

async function expectViewportFit(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function mockCustomer(page: Page) {
  await page.route("**/api/customer/session", (route) => route.fulfill({ json: { customer: { id: "customer-1", name: "Cliente Mi Bicla", firstName: "Cliente", phone: "4420000000", accountStatus: "active" }, csrfToken: "test" } }));
  await page.route("**/api/customer/me", (route) => route.fulfill({ json: { id: "customer-1", name: "Cliente Mi Bicla", firstName: "Cliente", phone: "4420000000", accountStatus: "active" } }));
  await page.route("**/api/customer/loyalty", (route) => route.fulfill({ json: { name: "Cliente Mi Bicla", balance: { availableUnits: 6, pendingUnits: 0, lifetimeUnits: 6 }, rewards: [], movements: [], loyaltyProgram: { rewardUnits: 10, rewardName: "Servicio", enabled: true } } }));
  await page.route("**/api/customer/card-link", (route) => route.fulfill({ json: { cardUrl: "https://mibicla.test/mi/tarjeta/test-token" } }));
}

test("customer navigation and QR fit the supported viewport matrix", async ({ page }, testInfo) => {
  await mockCustomer(page);
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/mi");
    const bottomNavigation = page.getByRole("navigation", { name: "Navegación del cliente" });
    for (const label of ["Inicio", "Biclas", "Órdenes", "Eventos", "Menú"]) {
      await expect(bottomNavigation.getByText(label, { exact: true })).toBeVisible();
    }
    await expectViewportFit(page);

    await page.getByRole("button", { name: "Menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú" });
    await expect(menu.getByRole("navigation", { name: "Todos los destinos del cliente" }).getByRole("link")).toHaveCount(8);
    await expect(menu.getByRole("heading", { name: "Taller" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Menú" })).toBeFocused();

    await page.getByRole("button", { name: "Ver mi QR" }).click();
    const dialog = page.getByRole("dialog", { name: "Tu código QR" });
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeVisible();
    await expect(dialog.locator("img")).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    await testInfo.attach(`customer-qr-${width}x${height}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await dialog.getByRole("button", { name: "Cerrar" }).click();
  }
});

test("admin workshop shell remains usable at narrow and landscape sizes", async ({ page }, testInfo) => {
  await page.route("**/auth/session", (route) => route.fulfill({ json: { csrfToken: "test", administrator: { id: "admin-1", name: "Admin Mi Bicla", email: "admin@example.com", role: "owner", permissions: ["view_reports", "view_customers", "view_loyalty", "view_workshop_orders", "view_workshop_requests", "manage_workshop_orders", "manage_workshop_agreements", "manage_events", "manage_products", "manage_catalog_requests", "view_deposit_settings", "manage_employees", "view_business_settings"] } } }));
  await page.route("**/api/admin/customers**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/admin/workshop/requests", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/admin/workshop/orders", (route) => route.fulfill({ json: [{ id: "order-1", orderNumber: "MB-2026-000000000001", status: "waiting_parts", customerId: "customer-1", bicycleId: "bike-1", problemDescription: "Ajuste completo de transmisión y revisión de frenos", customerVisibleSummary: null }] }));

  for (const [width, height] of [[320, 568], [768, 1024], [1024, 768]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/admin/workshop");
    await expect(page.getByRole("heading", { level: 1, name: "Taller" })).toBeVisible();
    const ordersTab = page.getByRole("tab", { name: /Órdenes/ });
    if (await ordersTab.isVisible()) await ordersTab.click();
    await expect(page.getByText("MB-2026-000000000001")).toBeVisible();
    await expectViewportFit(page);
    await testInfo.attach(`admin-workshop-${width}x${height}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    if (width < 1024) {
      const menuButton = page.getByRole("button", { name: "Abrir navegación administrativa" });
      await menuButton.click();
      const drawer = page.getByRole("dialog", { name: "Navegación administrativa" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("link")).toHaveCount(11);
      await expect(drawer.getByRole("heading", { name: "Operación" })).toBeVisible();
      await expect(drawer.getByRole("heading", { name: "Comunidad" })).toBeVisible();
      await expect(drawer.getByRole("heading", { name: "Administración" })).toBeVisible();
      await expect(drawer.getByRole("heading", { name: "Configuración" })).toBeVisible();
      await expect(drawer.getByText("Admin Mi Bicla", { exact: true })).toBeVisible();
      await expect(drawer.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(menuButton).toBeFocused();

      await menuButton.click();
      await page.mouse.click(width - 4, height / 2);
      await expect(drawer).toBeHidden();
    } else {
      const sidebar = page.getByRole("complementary", { name: "Panel administrativo" });
      const toggle = sidebar.getByRole("button", { name: "Contraer navegación" });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(sidebar.getByRole("button", { name: "Expandir navegación" })).toBeVisible();
      await page.reload();
      await expect(sidebar.getByRole("button", { name: "Expandir navegación" })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("mb_admin_sidebar_collapsed"))).toBe("true");
    }
  }
});

test("administrative users keep clear cards and actions across viewports", async ({ page }, testInfo) => {
  await page.route("**/auth/session", (route) => route.fulfill({ json: { csrfToken: "test", administrator: { id: "owner-1", name: "Kari Maldonado", email: "kari@example.com", role: "owner", permissions: ["manage_employees", "view_reports"] } } }));
  await page.route("**/api/admin/administrators", (route) => route.fulfill({ json: [
    { id: "admin-1", name: "Gio MalHer", email: "gio@example.com", role: "admin", isActive: true, lastLoginAt: "2026-08-13T17:46:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-08-13T17:46:00.000Z" },
    { id: "employee-1", name: "Isbet Murillo", email: "isbet@example.com", role: "employee", isActive: true, lastLoginAt: "2026-08-13T17:21:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-08-13T17:21:00.000Z" },
    { id: "owner-1", name: "Kari Maldonado", email: "kari@example.com", role: "owner", isActive: true, lastLoginAt: "2026-08-13T20:31:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-08-13T20:31:00.000Z" },
  ] }));

  for (const [width, height] of [[320, 568], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios administrativos" })).toBeVisible();
    await expect(page.locator(".administrative-user-card")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Cambiar contraseña" }).first()).toBeVisible();
    await expect(page.getByText("Cuenta protegida.")).toBeVisible();
    await expectViewportFit(page);
    await testInfo.attach(`admin-users-${width}x${height}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
});
