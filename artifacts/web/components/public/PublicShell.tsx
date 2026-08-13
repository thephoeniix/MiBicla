import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLogo } from "../brand";
import footerChain from "../../../../logo/footer.svg";

export interface PublicBusiness {
  businessName?: string;
  address?: string;
  phone?: string;
  email?: string;
  primaryWhatsapp?: string;
  secondaryWhatsapp?: string;
  // El endpoint público (BusinessSettingsService.getPublicBusiness) anida los
  // enlaces sociales bajo "social", a diferencia del esquema plano usado en
  // administración. No aplanar aquí: hacerlo desincroniza este tipo de la
  // forma real de la respuesta.
  social?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    website?: string;
  };
  openingHours?: Record<string, string>;
  logoUrl?: string;
}

const NAV = [
  ["/", "Inicio"],
  ["/taller", "Taller"],
  ["/fidelidad", "Mi Tarjeta"],
] as const;

function isPublicNavigationActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function FooterChainDivider() {
  return (
    <div className="footer-chain-divider" aria-hidden="true">
      <img src={footerChain} alt="" width={2048} height={65} />
    </div>
  );
}

function PublicFooter() {
  const year = new Date().getFullYear();
  const goTop = () => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };
  return (
    <footer className="brand-footer">
      <div className="footer-simple">
        <section className="footer-brand">
          <BrandLogo variant="full" color="white" />
          <strong>QUERÉTARO · MÉXICO</strong>
          <p>Taller, comunidad y recompensas para seguir rodando.</p>
        </section>
        <FooterChainDivider />
        <div className="footer-legal">
          <span>© {year} MI BICLA QUERÉTARO</span>
          <button type="button" onClick={goTop}>Ir arriba <span aria-hidden="true">↑</span></button>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({
  children,
}: {
  children: ReactNode;
  business?: PublicBusiness | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const mobileMenu = useRef<HTMLDivElement>(null);
  const path = window.location.pathname;
  useEffect(() => {
    if (!menuOpen) return;
    const overflow = document.body.style.overflow;
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
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", close);
      menuButton.current?.focus();
    };
  }, [menuOpen]);
  return (
    <div className="public-shell">
      <a className="mb-sr-only mb-sr-only-focusable" href="#public-content">Saltar al contenido</a>
      <header className="public-header">
        <a className="app-brand" href="/">
          <BrandLogo variant="symbol" color="pink" />
        </a>
        <button
          ref={menuButton}
          className="public-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Menú"}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-menu"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className="public-menu-icon" aria-hidden="true"><i /><i /><i /></span>
          <span className="public-menu-label">{menuOpen ? "Cerrar" : "Menú"}</span>
        </button>
        <nav aria-label="Navegación pública">
          {NAV.map(([href, label]) => <a key={href} href={href} aria-current={isPublicNavigationActive(path, href) ? "page" : undefined}>{label}</a>)}
          <a href="/productos" aria-current={path === "/productos" ? "page" : undefined}>Productos</a>
          <a href="/eventos" aria-current={path === "/eventos" ? "page" : undefined}>Eventos</a>
          <a href="/depositos">Métodos de pago</a>
          <a href="/#contacto">Contacto</a>
        </nav>
        <div className="public-account-links">
          <a href="/iniciar-sesion">Iniciar sesión</a>
          <a className="ui-button" href="/registro">Crear cuenta</a>
        </div>
      </header>
      {menuOpen && (
        <div className="public-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
          <div ref={mobileMenu} className="public-mobile-menu" id="public-mobile-menu" role="dialog" aria-modal="true" aria-label="Menú principal">
            <nav aria-label="Menú público" onClick={(event) => { if ((event.target as Element).closest("a")) setMenuOpen(false); }}>
              <section aria-labelledby="public-menu-explore"><h2 id="public-menu-explore">Explorar</h2>
                {NAV.map(([href, label]) => <a key={href} href={href} aria-current={isPublicNavigationActive(path, href) ? "page" : undefined}>{label}</a>)}
                <a href="/productos" aria-current={path === "/productos" ? "page" : undefined}>Productos</a>
                <a href="/eventos" aria-current={path === "/eventos" ? "page" : undefined}>Eventos</a>
              </section>
              <section aria-labelledby="public-menu-account"><h2 id="public-menu-account">Tu cuenta</h2>
                <a href="/mi/taller" aria-current={isPublicNavigationActive(path, "/mi/taller") ? "page" : undefined}>Consultar orden</a>
                <a href="/mi/tarjeta" aria-current={isPublicNavigationActive(path, "/mi/tarjeta") ? "page" : undefined}>Mi tarjeta</a>
                <a href="/iniciar-sesion" aria-current={path === "/iniciar-sesion" ? "page" : undefined}>Iniciar sesión</a>
                <a className="ui-button" href="/registro" aria-current={path === "/registro" ? "page" : undefined}>Crear mi cuenta</a>
              </section>
              <section aria-labelledby="public-menu-help"><h2 id="public-menu-help">Ayuda</h2>
                <a href="/depositos" aria-current={path === "/depositos" ? "page" : undefined}>Métodos de pago</a>
                <a href="/#contacto">Contacto</a>
              </section>
            </nav>
          </div>
        </div>
      )}
      <main id="public-content">{children}</main>
      <PublicFooter />
    </div>
  );
}
