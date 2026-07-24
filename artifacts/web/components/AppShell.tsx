import { useEffect, useState, type ReactNode } from "react";
import { CustomerScanFlow } from "./scanner/CustomerScanFlow";
import { canShowCustomerScanner } from "./scanner/scanner-utils";
import { ThemeSelector } from "./ThemeSelector";

interface User {
  name: string;
  role: string;
  permissions: string[];
}

const NAV_ITEMS = [
  {
    href: "/admin/settings/general",
    label: "Inicio",
    short: "Inicio",
    icon: "⌂",
    permissions: ["view_business_settings"],
  },
  {
    href: "/admin/customers",
    label: "Clientes",
    short: "Clientes",
    icon: "♙",
    permissions: ["view_customers"],
  },
  {
    href: "/admin/workshop",
    label: "Taller",
    short: "Taller",
    icon: "◇",
    permissions: ["view_workshop_orders", "view_workshop_requests"],
  },
  {
    href: "/admin/settings/loyalty",
    label: "Fidelidad",
    short: "Fidelidad",
    icon: "♡",
    permissions: ["view_loyalty"],
  },
  {
    href: "/admin/settings/deposits",
    label: "Más",
    short: "Más",
    icon: "•••",
    permissions: ["view_deposit_settings", "view_business_settings"],
  },
] as const;

export const MOBILE_NAV = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  NAV_ITEMS[4],
] as const;

export function isMobileNavigationActive(pathname: string, href: string) {
  if (href === "/admin/settings/deposits")
    return (
      pathname.startsWith("/admin/settings/") &&
      pathname !== "/admin/settings/general"
    );
  return (
    pathname === href ||
    (href === "/admin/settings/general" && pathname === "/admin")
  );
}

function MobileHeader({ user }: { user: User }) {
  return (
    <header className="mobile-header">
      <a className="app-brand" href="/admin/settings/general">
        <img src="/pink-simple.png" alt="" />
        <strong>Mi Bicla</strong>
      </a>
      <div>
        <ThemeSelector compact />
        <span>{user.name.slice(0, 1).toUpperCase()}</span>
      </div>
    </header>
  );
}

function BottomNavigation({
  pathname,
}: {
  pathname: string;
}) {
  return (
    <nav className="bottom-navigation" aria-label="Navegación móvil">
      {MOBILE_NAV.map((item) => {
        const active = isMobileNavigationActive(pathname, item.href);
        return (
        <a
          href={item.href}
          key={item.href}
          aria-current={active ? "page" : undefined}
        >
          <i aria-hidden="true">{item.icon}</i>
          <span>{item.short}</span>
        </a>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  onLogout,
  children,
}: {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const available = NAV_ITEMS.filter((item) =>
    item.permissions.some((permission) =>
      user.permissions.includes(permission),
    ),
  );
  const pathname = window.location.pathname;
  const canScan = canShowCustomerScanner(pathname, user.permissions);
  useEffect(() => {
    const openScanner = () => setScannerOpen(true);
    window.addEventListener("scanner:open", openScanner);
    return () => window.removeEventListener("scanner:open", openScanner);
  }, []);
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <a className="app-brand" href="/admin/settings/general">
          <img src="/pink-simple.png" alt="" />
          <span>
            <strong>Mi Bicla</strong>
            <small>Querétaro</small>
          </span>
        </a>
        <nav aria-label="Navegación principal">
          {available.map((item) => (
            <a
              href={item.href}
              key={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <i aria-hidden="true">{item.icon}</i>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="app-user">
          <span>{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <button type="button" onClick={onLogout} aria-label="Cerrar sesión">
            ↗
          </button>
        </div>
      </aside>
      <MobileHeader user={user} />
      <div className="app-main">
        <div className="app-topbar">
          <p>
            <span>Mi Bicla Querétaro</span>
            <strong>Hola, {user.name.split(" ")[0]}</strong>
          </p>
          <div>
            <ThemeSelector compact />
            <button type="button" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
        <main className="app-content">{children}</main>
      </div>
      <BottomNavigation pathname={pathname} />
      {canScan && (
        <button
          type="button"
          className="scan-quick-action"
          onClick={() => setScannerOpen(true)}
        >
          <i aria-hidden="true">⌗</i>
          Escanear cliente
        </button>
      )}
      <CustomerScanFlow
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
