import { useEffect, useState, type ReactNode } from "react";
import { CustomerScanFlow } from "./scanner/CustomerScanFlow";
import { canShowCustomerScanner } from "./scanner/scanner-utils";
import { ThemeSelector } from "./ThemeSelector";
import { BrandLogo } from "./brand";
import {
  AdminHomeIcon,
  AdministrativeUsersIcon,
  ClientsIcon,
  DepositsIcon,
  EventsIcon,
  LoyaltyAdminIcon,
  MoreIcon,
  ProductsIcon,
  RequestsIcon,
  SettingsIcon,
  WorkshopAdminIcon,
} from "./nav-icons";

interface User {
  name: string;
  role: string;
  permissions: string[];
}

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Inicio",
    short: "Inicio",
    icon: <AdminHomeIcon />,
    permissions: ["view_reports"],
  },
  {
    href: "/admin/customers",
    label: "Clientes",
    short: "Clientes",
    icon: <ClientsIcon />,
    permissions: ["view_customers"],
  },
  {
    href: "/admin/loyalty",
    label: "Loyalty",
    short: "Loyalty",
    icon: <LoyaltyAdminIcon />,
    permissions: ["view_loyalty"],
  },
  {
    href: "/admin/workshop",
    label: "Taller",
    short: "Taller",
    icon: <WorkshopAdminIcon />,
    permissions: ["view_workshop_orders", "view_workshop_requests"],
  },
  {
    href: "/admin/events",
    label: "Eventos",
    short: "Eventos",
    icon: <EventsIcon />,
    permissions: ["manage_events"],
  },
  {
    href: "/admin/products",
    label: "Productos",
    short: "Productos",
    icon: <ProductsIcon />,
    permissions: ["manage_products"],
  },
  {
    href: "/admin/requests",
    label: "Solicitudes y cotizaciones",
    short: "Solicitudes",
    icon: <RequestsIcon />,
    permissions: ["manage_catalog_requests"],
  },
  {
    href: "/admin/settings/deposits",
    label: "Métodos de pago",
    short: "Pagos",
    icon: <DepositsIcon />,
    permissions: ["view_deposit_settings"],
  },
  {
    href: "/admin/users",
    label: "Usuarios administrativos",
    short: "Usuarios",
    icon: <AdministrativeUsersIcon />,
    permissions: ["manage_employees"],
    ownerOnly: true,
  },
  {
    href: "/admin/settings/general",
    label: "Configuración",
    short: "Config.",
    icon: <SettingsIcon />,
    permissions: ["view_business_settings", "view_deposit_settings"],
    ownerOnly: false,
  },
] as const;

export const MOBILE_NAV = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[3],
] as const;

export function isMobileNavigationActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/admin" && pathname.startsWith(`${href}/`))
  );
}

function MobileHeader({ user }: { user: User }) {
  return (
    <header className="mobile-header">
      <a className="app-brand" href="/admin">
        <BrandLogo variant="full" color="white" />
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
  available,
}: {
  pathname: string;
  available: typeof NAV_ITEMS[number][];
}) {
  const [more, setMore] = useState(false);
  const fixed = MOBILE_NAV.filter((item) => available.some(({ href }) => href === item.href));
  const overflow = available.filter((item) => !fixed.some(({ href }) => href === item.href));
  return (
    <>
    <nav className="bottom-navigation" aria-label="Navegación móvil">
      {fixed.map((item) => {
        const active = isMobileNavigationActive(pathname, item.href);
        return (
        <a
          href={item.href}
          key={item.href}
          title={item.label}
          aria-current={active ? "page" : undefined}
        >
          <i aria-hidden="true">{item.icon}</i>
          <span>{item.short}</span>
        </a>
        );
      })}
      <button type="button" aria-expanded={more} onClick={() => setMore((value) => !value)}><i aria-hidden="true"><MoreIcon /></i><span>Más</span></button>
    </nav>
    {more && <nav className="admin-more-menu" aria-label="Más secciones">{overflow.map((item) => <a key={item.href} href={item.href} aria-current={isMobileNavigationActive(pathname, item.href) ? "page" : undefined}><i aria-hidden="true">{item.icon}</i>{item.label}</a>)}</nav>}
    </>
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
    (!("ownerOnly" in item) || !item.ownerOnly || user.role === "owner") &&
    item.permissions.some((permission) => user.permissions.includes(permission)),
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
        <a className="app-brand" href="/admin">
          <BrandLogo variant="full" color="white" />
        </a>
        <nav aria-label="Navegación principal">
          {available.map((item) => (
            <a
              href={item.href}
              key={item.href}
              title={item.label}
              aria-current={isMobileNavigationActive(pathname, item.href) ? "page" : undefined}
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
      <BottomNavigation pathname={pathname} available={[...available]} />
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
