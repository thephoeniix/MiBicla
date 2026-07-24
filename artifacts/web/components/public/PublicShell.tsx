import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeSelector } from "../ThemeSelector";
import { TokenAccessDialog } from "./TokenAccessDialog";
import { ChainDivider } from "../brand";

export interface PublicBusiness {
  businessName?: string;
  address?: string;
  phone?: string;
  email?: string;
  primaryWhatsapp?: string;
  secondaryWhatsapp?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
  openingHours?: Record<string, string>;
  logoUrl?: string;
}

const NAV = [
  ["/", "Inicio", "⌂"],
  ["/taller", "Taller", "◇"],
  ["/fidelidad", "Fidelidad", "♡"],
  ["/marcas", "Marcas", "✦"],
] as const;

export function PublicShell({
  children,
  business,
}: {
  children: ReactNode;
  business?: PublicBusiness | null;
}) {
  const [dialog, setDialog] = useState<"workshop" | "card" | null>(null);
  const [more, setMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const mobileMenu = useRef<HTMLDivElement>(null);
  const path = window.location.pathname;
  useEffect(() => {
    const handler = (event: Event) =>
      setDialog((event as CustomEvent<"workshop" | "card">).detail);
    window.addEventListener("public:token-dialog", handler);
    return () => window.removeEventListener("public:token-dialog", handler);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = mobileMenu.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    requestAnimationFrame(() =>
      mobileMenu.current?.querySelector<HTMLElement>("a[href]")?.focus(),
    );
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
      menuButton.current?.focus();
    };
  }, [menuOpen]);
  return (
    <div className="public-shell">
      <a className="mb-sr-only mb-sr-only-focusable" href="#public-content">Saltar al contenido</a>
      <header className="public-header">
        <a className="app-brand" href="/">
          <img src={business?.logoUrl || "/pink-simple.png"} alt="" />
          <strong>{business?.businessName || "Mi Bicla"}</strong>
        </a>
        <button
          ref={menuButton}
          className="public-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-menu"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span /><span /><span />
        </button>
        <nav aria-label="Navegación pública">
          {NAV.map(([href, label]) => <a key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</a>)}
          <a href="/depositos">Depósitos</a>
          <a href="/#ubicacion">Ubicación</a>
        </nav>
        <div className="public-account-links">
          <a href="/iniciar-sesion">Iniciar sesión</a>
          <a className="ui-button" href="/registro">Crear cuenta</a>
          <ThemeSelector compact />
        </div>
      </header>
      {menuOpen && (
        <div
          ref={mobileMenu}
          className="public-mobile-menu"
          id="public-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal"
        >
          <nav aria-label="Menú público">
            {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            <a href="/depositos">Depósitos</a>
            <a href="/iniciar-sesion">Iniciar sesión</a>
            <a className="ui-button" href="/registro">Crear mi cuenta</a>
          </nav>
          <ThemeSelector />
        </div>
      )}
      <main id="public-content">{children}</main>
      <footer className="brand-footer">
        <ChainDivider />
        <div>
          <a className="app-brand" href="/">
            <img src="/pink-simple.png" alt="" />
            <span><strong>MI BICLA</strong><small>QUERÉTARO</small></span>
          </a>
          <p>Taller, comunidad y recompensas para seguir rodando.</p>
          <nav aria-label="Enlaces del pie de página">
            <a href="/taller">Taller</a>
            <a href="/fidelidad">Fidelidad</a>
            <a href="/depositos">Depósitos</a>
            <a href="/admin">Administración</a>
          </nav>
        </div>
      </footer>
      <nav className="public-bottom-nav" aria-label="Navegación pública móvil">
        {NAV.map(([href, label, icon]) => <a key={href} href={href} aria-current={path === href ? "page" : undefined}><i aria-hidden="true">{icon}</i>{label}</a>)}
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)}><i aria-hidden="true">•••</i>Más</button>
      </nav>
      {more && <div className="public-more-menu">
        <a href="/depositos">Depósitos</a><a href="/#horarios">Horarios</a><a href="/#ubicacion">Ubicación</a><a href="/#redes">Redes sociales</a>
        <button type="button" onClick={() => { setMore(false); setDialog("workshop"); }}>Consultar orden</button>
        <button type="button" onClick={() => { setMore(false); setDialog("card"); }}>Mi tarjeta</button>
      </div>}
      <TokenAccessDialog open={dialog !== null} kind={dialog || "workshop"} onClose={() => setDialog(null)} />
    </div>
  );
}

export function openTokenDialog(kind: "workshop" | "card") {
  window.dispatchEvent(new CustomEvent("public:token-dialog", { detail: kind }));
}
