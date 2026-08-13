const LEGACY_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export function extractCustomerToken(value: string): string | null {
  const candidate = value.trim();
  if (SHORT_CODE_PATTERN.test(candidate)) return candidate;
  if (LEGACY_TOKEN_PATTERN.test(candidate)) return candidate.toLowerCase();
  try {
    const url = new URL(candidate, "https://scanner.mibicla.invalid");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const short = url.pathname.match(/^\/l\/([^/]+)\/?$/)?.[1];
    if (short && SHORT_CODE_PATTERN.test(short)) return short;
    const legacy = url.pathname.match(/^\/c\/([^/]+)\/?$/)?.[1];
    if (legacy && LEGACY_TOKEN_PATTERN.test(legacy)) return legacy.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

export function customerAdminProfileUrl(customerId: string) {
  return `/admin/customers?customer=${encodeURIComponent(customerId)}`;
}

export function createScanGate() {
  let paused = false;
  let lastValue = "";
  return {
    accept(value: string) {
      if (paused || value === lastValue) return false;
      lastValue = value;
      paused = true;
      return true;
    },
    reset() {
      paused = false;
      lastValue = "";
    },
    get paused() {
      return paused;
    },
  };
}

export function stopMediaStream(
  stream: Pick<MediaStream, "getTracks"> | null,
) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function cameraErrorMessage(error: unknown): string {
  if (
    error instanceof DOMException &&
    ["NotAllowedError", "SecurityError"].includes(error.name)
  )
    return "No diste permiso para usar la cámara. Habilítala en los permisos del navegador o ingresa el enlace manualmente.";
  if (
    error instanceof DOMException &&
    ["NotFoundError", "OverconstrainedError"].includes(error.name)
  )
    return "No encontramos una cámara disponible. Puedes ingresar el enlace del cliente manualmente.";
  return "No fue posible iniciar la cámara. Verifica que el sitio use HTTPS o ingresa el enlace manualmente.";
}

export function canShowCustomerScanner(
  pathname: string,
  permissions: readonly string[],
) {
  return (
    [
      "/admin",
      "/admin/settings/general",
      "/admin/customers",
      "/admin/loyalty",
      "/admin/settings/loyalty",
    ].includes(pathname) && permissions.includes("adjust_loyalty")
  );
}
