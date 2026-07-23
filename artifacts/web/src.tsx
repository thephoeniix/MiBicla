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
    apiFetch<{ administrator: Administrator }>("/auth/session")
      .then((x) => setUser(x.administrator))
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
        {window.location.pathname === "/admin/workshop" ? (
          <Workshop permissions={user.permissions} />
        ) : window.location.pathname === "/admin/customers" ? (
          <Customers permissions={user.permissions} />
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
          <img src="/pink-simple.png" alt="Mi Bicla" />
          <p>Mi Bicla Querétaro</p>
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
  if (window.location.pathname === "/taller/solicitud")
    return <WorkshopRequest />;
  const workshopToken =
    window.location.pathname.match(/^\/taller\/([^/]+)$/)?.[1];
  if (workshopToken) return <WorkshopTracking token={workshopToken} />;
  const customerToken = window.location.pathname.match(/^\/c\/([^/]+)$/)?.[1];
  if (customerToken) return <CustomerCard token={customerToken} />;
  return window.location.pathname === "/depositos" ? (
    <Depositos />
  ) : (
    <AdminApp />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
