import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { General } from "./pages/admin/settings/General";
import { Deposits } from "./pages/admin/settings/Deposits";
import { Social } from "./pages/admin/settings/Social";
import { Depositos } from "./pages/public/Depositos";
import { apiFetch, ApiError } from "./lib/api-client";
interface Administrator {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}
function AdminApp() {
  const [user, setUser] = useState<Administrator | null>(null),
    [error, setError] = useState("");
  const session = () =>
    apiFetch<{ administrator: Administrator }>("/auth/session")
      .then((x) => setUser(x.administrator))
      .catch((e) => {
        setUser(null);
        if (e instanceof ApiError && e.status !== 401) setError(e.message);
      });
  useEffect(() => {
    session();
    const unauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", unauthorized);
    return () => window.removeEventListener("auth:unauthorized", unauthorized);
  }, []);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
  return (
    <main>
      <img src="/pink-simple.png" alt="Mi Bicla" />
      <h1>Mi Bicla</h1>
      {user ? (
        <div className="admin-layout">
          <aside>
            <p>Hola, {user.name}</p>
            <nav aria-label="Configuración">
              <strong>Configuración</strong>
              <a href="/admin/settings/general">General</a>
              <a href="/admin/settings/deposits">Depósitos</a>
              <a href="/admin/settings/social">Redes Sociales</a>
            </nav>
            <button onClick={logout}>Cerrar sesión</button>
          </aside>
          <section>
            {window.location.pathname.endsWith("/deposits") ? (
              <Deposits />
            ) : window.location.pathname.endsWith("/social") ? (
              <Social />
            ) : (
              <General />
            )}
          </section>
        </div>
      ) : (
        <form onSubmit={login}>
          <label>
            Correo
            <input name="email" type="email" maxLength={254} required />
          </label>
          <label>
            Contraseña
            <input name="password" type="password" maxLength={128} required />
          </label>
          <button>Iniciar sesión</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </main>
  );
}
function App() {
  return window.location.pathname === "/depositos" ? (
    <Depositos />
  ) : (
    <AdminApp />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
