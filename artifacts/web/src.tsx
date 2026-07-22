import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
function App() {
  const [user, setUser] = useState<any>(null),
    [csrf, setCsrf] = useState(""),
    [error, setError] = useState("");
  const session = () =>
    fetch(`${API}/auth/session`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => setUser(x?.administrator));
  useEffect(() => {
    session();
  }, []);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      r = await fetch(`${API}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
    if (!r.ok) return setError("No fue posible iniciar sesión.");
    const x = await r.json();
    setCsrf(x.csrfToken);
    setError("");
    await session();
  }
  async function logout() {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrf },
    });
    setUser(null);
  }
  return (
    <main>
      <img src="/pink-simple.png" />
      <h1>Mi Bicla</h1>
      {user ? (
        <>
          <p>Hola, {user.name}</p>
          <button onClick={logout}>Cerrar sesión</button>
        </>
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
createRoot(document.getElementById("root")!).render(<App />);
