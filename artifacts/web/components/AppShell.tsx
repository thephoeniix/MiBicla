import { useEffect, useState, type ReactNode } from "react";
import { CustomerScanFlow } from "./scanner/CustomerScanFlow";
import { canShowCustomerScanner } from "./scanner/scanner-utils";
import { ThemeSelector } from "./ThemeSelector";
import { BrandLogo } from "./brand";
import { Dialog } from "./ui";
import {
  AdminHomeIcon,
  AdministrativeUsersIcon,
  ClientsIcon,
  DepositsIcon,
  EventsIcon,
  LoyaltyAdminIcon,
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
    group: "Operación",
    href: "/admin",
    label: "Inicio",
    short: "Inicio",
    icon: <AdminHomeIcon />,
    permissions: ["view_reports"],
  },
  {
    group: "Operación",
    href: "/admin/customers",
    label: "Clientes",
    short: "Clientes",
    icon: <ClientsIcon />,
    permissions: ["view_customers"],
  },
  {
    group: "Operación",
    href: "/admin/loyalty",
    label: "Loyalty",
    short: "Loyalty",
    icon: <LoyaltyAdminIcon />,
    permissions: ["view_loyalty"],
  },
  {
    group: "Operación",
    href: "/admin/workshop",
    label: "Taller",
    short: "Taller",
    icon: <WorkshopAdminIcon />,
    permissions: ["view_workshop_orders", "view_workshop_requests"],
  },
  {
    group: "Comunidad",
    href: "/admin/agreements",
    label: "Equipos y convenios",
    short: "Convenios",
    icon: <RequestsIcon />,
    permissions: ["manage_workshop_agreements"],
  },
  {
    group: "Comunidad",
    href: "/admin/events",
    label: "Eventos",
    short: "Eventos",
    icon: <EventsIcon />,
    permissions: ["manage_events"],
  },
  {
    group: "Administración",
    href: "/admin/products",
    label: "Productos",
    short: "Productos",
    icon: <ProductsIcon />,
    permissions: ["manage_products"],
  },
  {
    group: "Administración",
    href: "/admin/requests",
    label: "Solicitudes y cotizaciones",
    short: "Solicitudes",
    icon: <RequestsIcon />,
    permissions: ["manage_catalog_requests"],
  },
  {
    group: "Administración",
    href: "/admin/settings/deposits",
    label: "Métodos de pago",
    short: "Pagos",
    icon: <DepositsIcon />,
    permissions: ["view_deposit_settings"],
  },
  {
    group: "Administración",
    href: "/admin/users",
    label: "Usuarios administrativos",
    short: "Usuarios",
    icon: <AdministrativeUsersIcon />,
    permissions: ["manage_employees"],
    ownerOnly: true,
  },
  {
    group: "Configuración",
    href: "/admin/settings/general",
    label: "Configuración",
    short: "Config.",
    icon: <SettingsIcon />,
    permissions: ["view_business_settings", "view_deposit_settings"],
    ownerOnly: false,
  },
] as const;

export const SIDEBAR_STORAGE_KEY = "mb_admin_sidebar_collapsed";

export function readSidebarCollapsed(
  storage: Pick<Storage, "getItem"> = localStorage,
) {
  try {
    return storage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistSidebarCollapsed(
  collapsed: boolean,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
}

export function isMobileNavigationActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/admin" && pathname.startsWith(`${href}/`))
  );
}

type NavItem = (typeof NAV_ITEMS)[number];

function NavigationGroups({
  pathname,
  available,
  onNavigate,
}: {
  pathname: string;
  available: NavItem[];
  onNavigate?: () => void;
}) {
  return ["Operación", "Comunidad", "Administración", "Configuración"].map(
    (group) => {
      const items = available.filter((item) => item.group === group);
      if (!items.length) return null;
      return (
        <section className="admin-nav-group" key={group}>
          <h2>{group}</h2>
          {items.map((item) => (
            <a
              href={item.href}
              key={item.href}
              title={item.label}
              aria-current={
                isMobileNavigationActive(pathname, item.href)
                  ? "page"
                  : undefined
              }
              onClick={onNavigate}
            >
              <i aria-hidden="true">{item.icon}</i>
              <span>{item.label}</span>
            </a>
          ))}
        </section>
      );
    },
  );
}

function MobileHeader({
  user,
  onOpenMenu,
}: {
  user: User;
  onOpenMenu: () => void;
}) {
  return (
    <header className="mobile-header">
      <button
        className="admin-menu-toggle"
        type="button"
        aria-label="Abrir navegación administrativa"
        aria-haspopup="dialog"
        aria-controls="admin-mobile-drawer"
        onClick={onOpenMenu}
      >
        <span className="admin-menu-toggle-icon" aria-hidden="true">☰</span>
        <span>Menú</span>
      </button>
      <a className="app-brand" href="/admin">
        <BrandLogo variant="full" color="white" />
      </a>
      <div>
        <ThemeSelector compact />
        <span
          title={`${user.name}, ${user.role}`}
          aria-label={`${user.name}, ${user.role}`}
        >
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      </div>
    </header>
  );
}

function MobileNavigationDrawer({
  open,
  pathname,
  available,
  user,
  onClose,
  onLogout,
}: {
  open: boolean;
  pathname: string;
  available: NavItem[];
  user: User;
  onClose: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;
  return (
    <Dialog
      open
      id="admin-mobile-drawer"
      className="admin-mobile-drawer"
      aria-labelledby="admin-mobile-drawer-title"
    >
      <section>
        <header>
          <div>
            <BrandLogo variant="full" color="white" />
            <h2 id="admin-mobile-drawer-title">Navegación administrativa</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar navegación administrativa"
            data-dialog-close
            autoFocus
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <nav aria-label="Navegación principal">
          <NavigationGroups
            pathname={pathname}
            available={available}
            onNavigate={onClose}
          />
        </nav>
        <footer className="admin-drawer-user">
          <span aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <button type="button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </footer>
      </section>
    </Dialog>
  );
}

function DesktopSidebar({
  collapsed,
  pathname,
  available,
  user,
  onToggle,
  onLogout,
}: {
  collapsed: boolean;
  pathname: string;
  available: NavItem[];
  user: User;
  onToggle: () => void;
  onLogout: () => void;
}) {
  return (
    <aside className="app-sidebar" aria-label="Panel administrativo">
      <div className="app-sidebar-header">
        <a className="app-brand" href="/admin" title="Mi Bicla">
          <BrandLogo variant="full" color="white" className="app-brand-full" />
          <BrandLogo
            variant="symbol"
            color="pink"
            decorative
            className="app-brand-symbol"
          />
        </a>
        <button
          className="app-sidebar-toggle"
          type="button"
          title={collapsed ? "Expandir navegación" : "Contraer navegación"}
          aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>
      <nav aria-label="Navegación principal">
        <NavigationGroups pathname={pathname} available={available} />
      </nav>
      <div
        className="app-user"
        title={`${user.name}, ${user.role}`}
        aria-label={`Usuario: ${user.name}, ${user.role}`}
      >
        <span aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          ↗
        </button>
      </div>
    </aside>
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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readSidebarCollapsed(),
  );
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
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      persistSidebarCollapsed(next);
    } catch {
      // The sidebar remains usable when browser storage is unavailable.
    }
  };
  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={sidebarCollapsed || undefined}
    >
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        pathname={pathname}
        available={[...available]}
        user={user}
        onToggle={toggleSidebar}
        onLogout={onLogout}
      />
      <MobileHeader
        user={user}
        onOpenMenu={() => setMobileNavigationOpen(true)}
      />
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
      <MobileNavigationDrawer
        open={mobileNavigationOpen}
        pathname={pathname}
        available={[...available]}
        user={user}
        onClose={() => setMobileNavigationOpen(false)}
        onLogout={onLogout}
      />
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
