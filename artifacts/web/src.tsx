import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { General } from "./pages/admin/settings/General";
import { Deposits } from "./pages/admin/settings/Deposits";
import { Social } from "./pages/admin/settings/Social";
import { Depositos } from "./pages/public/Depositos";
import { CustomerCard } from "./pages/public/CustomerCard";
import { Customers } from "./pages/admin/Customers";
import { Loyalty } from "./pages/admin/settings/Loyalty";
import { Workshop } from "./pages/admin/Workshop";
import { WorkshopRequest } from "./pages/public/WorkshopRequest";
import { WorkshopTracking } from "./pages/public/WorkshopTracking";
import { apiFetch, ApiError } from "./lib/api-client";
import { AppShell } from "./components/AppShell";
import { Button, Input, LoadingState } from "./components/ui";
import { BrandLogo } from "./components/brand";
import { Brands, Landing, LoyaltyInfo, WorkshopInfo } from "./pages/public/PublicPages";
import { resolvePublicRoute } from "./lib/public-routes";
import {
  CustomerActivation,
  CustomerAuthProvider,
  CustomerLogin,
  CustomerRecovery,
  CustomerRegistrationInfo,
} from "./pages/customer/CustomerAuth";
import { CustomerPortal } from "./pages/customer/CustomerPortal";
import { PublicEvents, PublicProducts } from "./pages/public/Commerce";
import { AdminDashboard, AdminEvents, AdminProducts, AdminRequests } from "./pages/admin/CommerceAdmin";
import { AdministrativeUsers } from "./pages/admin/AdministrativeUsers";
interface Administrator {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}
function AdminApp() {
  const [user, setUser] = useState<Administrator | null>(null),
    [error, setError] = useState(""),
    [sessionLoading, setSessionLoading] = useState(true),
    [loginLoading, setLoginLoading] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const session = () =>
    apiFetch<{ administrator: Administrator; csrfToken: string }>("/auth/session")
      .then((x) => {
        sessionStorage.setItem("mb_csrf", x.csrfToken);
        setUser(x.administrator);
      })
      .catch((e) => {
        setUser(null);
        if (e instanceof ApiError && e.status !== 401) setError(e.message);
      })
      .finally(() => setSessionLoading(false));
  useEffect(() => {
    session();
    const unauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", unauthorized);
    return () => window.removeEventListener("auth:unauthorized", unauthorized);
  }, []);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoginLoading(true);
    try {
      const x = await apiFetch<{ csrfToken: string }>("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      sessionStorage.setItem("mb_csrf", x.csrfToken);
      setError("");
      await session();
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "No fue posible iniciar sesión.",
      );
    } finally {
      setLoginLoading(false);
    }
  }
  async function logout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch (error) {
      if (error instanceof ApiError && error.status !== 401)
        setError(error.message);
    } finally {
      sessionStorage.removeItem("mb_csrf");
      setUser(null);
    }
  }
  if (sessionLoading)
    return (
      <main className="login-page">
        <LoadingState label="Preparando tu espacio…" />
      </main>
    );
  if (user)
    return (
      <AppShell user={user} onLogout={logout}>
        {window.location.pathname === "/admin" ? (
          <AdminDashboard />
        ) : window.location.pathname === "/admin/products" ? (
          <AdminProducts permissions={user.permissions} />
        ) : window.location.pathname === "/admin/events" ? (
          <AdminEvents permissions={user.permissions} />
        ) : window.location.pathname === "/admin/requests" ? (
          <AdminRequests permissions={user.permissions} />
        ) : window.location.pathname === "/admin/workshop" ? (
          <Workshop permissions={user.permissions} />
        ) : window.location.pathname.startsWith("/admin/customers") ? (
          <Customers permissions={user.permissions} />
        ) : window.location.pathname === "/admin/users" && user.role === "owner" ? (
          <AdministrativeUsers currentUserId={user.id} />
        ) : window.location.pathname.endsWith("/loyalty") ? (
          <Loyalty permissions={user.permissions} />
        ) : window.location.pathname.endsWith("/deposits") ? (
          <Deposits permissions={user.permissions} />
        ) : window.location.pathname.endsWith("/social") ? (
          <Social />
        ) : (
          <General />
        )}
      </AppShell>
    );
  return (
    <main className="login-page">
      <section className="login-card">
        <header>
          <BrandLogo variant="full" color="pink" />
        </header>
        <div className="login-heading">
          <p className="page-eyebrow">Panel administrativo</p>
          <h1>Qué gusto verte</h1>
          <p>Inicia sesión para continuar con tu taller.</p>
        </div>
        <form onSubmit={login}>
          <label>
            Correo electrónico
            <Input
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              maxLength={254}
              placeholder="nombre@ejemplo.com"
              required
            />
          </label>
          <label>
            Contraseña
            <span className="password-field">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                maxLength={128}
                placeholder="Tu contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button disabled={loginLoading}>
            {loginLoading ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
        <small>Acceso exclusivo para el equipo Mi Bicla.</small>
      </section>
    </main>
  );
}
function App() {
  const match = resolvePublicRoute(window.location.pathname);
  const meta: Record<string, [string, string, boolean?]> = {
    home: ["Mi Bicla Querétaro | Taller, equipo y comunidad MTB", "Taller, equipo y beneficios para disfrutar cada rodada."],
    workshop: ["Taller | Mi Bicla Querétaro", "Servicios de taller para mantener tu bicicleta lista para rodar."],
    loyalty: ["Fidelidad | Mi Bicla Querétaro", "Conoce el programa de fidelidad Mi Bicla."],
    brands: ["Marcas | Mi Bicla Querétaro", "Consulta las marcas disponibles en Mi Bicla Querétaro."],
    products: ["Productos | Mi Bicla Querétaro", "Productos, accesorios y equipo disponible en Mi Bicla."],
    events: ["Eventos | Mi Bicla Querétaro", "Rodadas y eventos de la comunidad Mi Bicla."],
    deposits: ["Métodos de pago | Mi Bicla Querétaro", "Métodos de pago activos de Mi Bicla Querétaro."],
    "customer-card": ["Mi tarjeta | Mi Bicla Querétaro", "Tarjeta personal de fidelidad.", true],
    "workshop-tracking": ["Seguimiento de taller | Mi Bicla Querétaro", "Seguimiento privado de servicio.", true],
    "customer-register": ["Activar cuenta | Mi Bicla Querétaro", "Información para activar una cuenta de cliente."],
    "customer-login": ["Iniciar sesión | Mi Bicla Querétaro", "Acceso de clientes de Mi Bicla."],
    "customer-activation": ["Activar cuenta | Mi Bicla Querétaro", "Activación segura de cuenta.", true],
    "customer-recovery": ["Recuperar acceso | Mi Bicla Querétaro", "Recuperación segura de acceso.", true],
    "customer-home": ["Mi espacio | Mi Bicla Querétaro", "Portal privado de clientes.", true],
    "customer-loyalty": ["Mi tarjeta | Mi Bicla Querétaro", "Puntos y recompensas del cliente.", true],
    "customer-workshop": ["Mi taller | Mi Bicla Querétaro", "Órdenes y seguimiento del cliente.", true],
    "customer-bikes": ["Mis bicicletas | Mi Bicla Querétaro", "Bicicletas vinculadas con el cliente.", true],
    "customer-profile": ["Mi perfil | Mi Bicla Querétaro", "Perfil privado del cliente.", true],
    "customer-products": ["Productos | Mi Bicla Querétaro", "Catálogo para clientes Mi Bicla.", true],
    "customer-events": ["Eventos | Mi Bicla Querétaro", "Eventos para clientes Mi Bicla.", true],
    "customer-requests": ["Mis solicitudes | Mi Bicla Querétaro", "Cotizaciones y reservaciones del cliente.", true],
  };
  const routeMeta = meta[match.route] ?? ["Mi Bicla Querétaro", "Taller, equipo y comunidad MTB."];
  const privateRoute = Boolean(routeMeta[2]) || [
    "admin",
    "customer-login",
    "customer-register",
    "customer-verify",
    "workshop-request",
    "not-found",
  ].includes(match.route);
  const canonicalUrl = `https://mibiclaqro.com${privateRoute ? "/" : window.location.pathname}`;
  const setMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
    let element = document.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.append(element);
    }
    element.content = content;
  };
  document.title = routeMeta[0];
  setMeta('meta[name="description"]', "name", "description", routeMeta[1]);
  setMeta('meta[name="robots"]', "name", "robots", privateRoute ? "noindex, nofollow" : "index, follow");
  setMeta('meta[property="og:title"]', "property", "og:title", routeMeta[0]);
  setMeta('meta[property="og:description"]', "property", "og:description", routeMeta[1]);
  setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
  switch (match.route) {
    case "home": return <Landing />;
    case "workshop": return <WorkshopInfo />;
    case "loyalty": return <LoyaltyInfo />;
    case "brands": return <Brands />;
    case "products": return <PublicProducts />;
    case "events": return <PublicEvents />;
    case "workshop-request": return <WorkshopRequest />;
    case "workshop-tracking": return <WorkshopTracking token={match.token!} />;
    case "customer-card": return <CustomerCard token={match.token!} />;
    case "deposits": return <Depositos />;
    case "customer-register": return <CustomerRegistrationInfo />;
    case "customer-login": return <CustomerAuthProvider><CustomerLogin /></CustomerAuthProvider>;
    case "customer-activation": return <CustomerActivation />;
    case "customer-recovery": return <CustomerRecovery />;
    case "customer-home":
    case "customer-loyalty":
    case "customer-workshop":
    case "customer-bikes":
    case "customer-profile":
    case "customer-products":
    case "customer-events":
    case "customer-requests":
      return <CustomerAuthProvider><CustomerPortal /></CustomerAuthProvider>;
    case "admin": return <AdminApp />;
    default: return <main className="login-page"><section className="login-card"><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></section></main>;
  }
}
createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => window.dispatchEvent(new Event("mb:app-ready")));
