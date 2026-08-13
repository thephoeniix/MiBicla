export type PublicRoute =
  | "home"
  | "workshop"
  | "loyalty"
  | "brands"
  | "products"
  | "events"
  | "deposits"
  | "workshop-request"
  | "workshop-tracking"
  | "customer-card"
  | "customer-register"
  | "customer-login"
  | "customer-home"
  | "customer-loyalty"
  | "customer-workshop"
  | "customer-bikes"
  | "customer-profile"
  | "customer-products"
  | "customer-events"
  | "customer-requests"
  | "customer-recovery"
  | "customer-activation"
  | "customer-verify"
  | "admin"
  | "not-found";

export function resolvePublicRoute(pathname: string): {
  route: PublicRoute;
  token?: string;
} {
  if (pathname === "/") return { route: "home" };
  if (pathname === "/taller") return { route: "workshop" };
  if (pathname === "/fidelidad") return { route: "loyalty" };
  if (pathname === "/marcas") return { route: "brands" };
  if (pathname === "/productos") return { route: "products" };
  if (pathname === "/eventos") return { route: "events" };
  if (pathname === "/depositos") return { route: "deposits" };
  if (pathname === "/registro") return { route: "customer-register" };
  if (pathname === "/registro/verificar") return { route: "customer-verify" };
  if (pathname === "/iniciar-sesion") return { route: "customer-login" };
  if (pathname === "/cuenta/activar") return { route: "customer-activation" };
  if (pathname === "/cuenta/recuperar" || pathname === "/recuperar-acceso")
    return { route: "customer-recovery" };
  if (pathname === "/mi") return { route: "customer-home" };
  if (pathname === "/mi/tarjeta") return { route: "customer-loyalty" };
  if (pathname === "/mi/taller") return { route: "customer-workshop" };
  if (pathname === "/mi/orden") return { route: "customer-workshop" };
  if (pathname === "/mi/ordenes") return { route: "customer-workshop" };
  if (pathname === "/mi/bicicletas") return { route: "customer-bikes" };
  if (pathname === "/mi/perfil") return { route: "customer-profile" };
  if (pathname === "/mi/productos") return { route: "customer-products" };
  if (pathname === "/mi/eventos") return { route: "customer-events" };
  if (pathname === "/mi/solicitudes") return { route: "customer-requests" };
  if (pathname.startsWith("/mi/")) return { route: "customer-home" };
  if (pathname === "/taller/solicitud") return { route: "workshop-request" };
  const workshop = pathname.match(/^\/taller\/([^/]+)$/);
  if (workshop) return { route: "workshop-tracking", token: workshop[1] };
  const card = pathname.match(/^\/c\/([^/]+)$/);
  if (card) return { route: "customer-card", token: card[1] };
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return { route: "admin" };
  return { route: "not-found" };
}

export function extractPublicToken(
  input: string,
  kind: "workshop" | "card",
): string | null {
  const value = input.trim();
  if (!value || value.length > 500) return null;
  let candidate = value;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const pattern = kind === "workshop" ? /^\/taller\/([^/]+)$/ : /^\/c\/([^/]+)$/;
    candidate = decodeURIComponent(url.pathname.match(pattern)?.[1] ?? "");
  } catch {
    if (value.includes("/") || value.includes("?") || value.includes("#"))
      return null;
  }
  if (candidate.length < 12 || candidate.length > 200) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate))
    return null;
  return /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null;
}
