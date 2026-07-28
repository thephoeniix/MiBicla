import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { BrandLogo } from "../../components/brand";
import { Container } from "../../components/primitives";
import { ThemeSelector } from "../../components/ThemeSelector";
import { Button, Card, Input, LoadingState } from "../../components/ui";
import { ApiError } from "../../lib/api-client";
import {
  activateCustomer,
  clearCustomerCsrf,
  createCustomerAuthSync,
  getCustomerMe,
  loginCustomer,
  logoutCustomer,
  recoverCustomer,
  restoreCustomerSession,
  safeInternalDestination,
  takeTokenFromLocation,
  validateActivation,
  type CustomerIdentity,
} from "../../lib/customer-auth";

type AuthState = "loading" | "anonymous" | "authenticated" | "error";
const AuthContext = createContext<{
  state: AuthState;
  customer: CustomerIdentity | null;
  restore: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("loading");
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const syncRef = useRef<ReturnType<typeof createCustomerAuthSync>>(null);
  const requestVersion = useRef(0);
  const restore = useCallback(async () => {
    const version = ++requestVersion.current;
    setState("loading");
    try {
      const session = await restoreCustomerSession();
      if (version !== requestVersion.current) return;
      syncRef.current?.publishCsrf(session.csrfToken);
      setCustomer(session.customer);
      setState("authenticated");
    } catch (error) {
      if (version !== requestVersion.current) return;
      clearCustomerCsrf();
      setCustomer(null);
      setState(error instanceof ApiError && error.status === 401 ? "anonymous" : "error");
    }
  }, []);
  useEffect(() => {
    syncRef.current = createCustomerAuthSync(() => {
      requestVersion.current += 1;
      setCustomer(null);
      setState("anonymous");
    });
    void restore();
    return () => {
      requestVersion.current += 1;
      syncRef.current?.close();
      syncRef.current = null;
    };
  }, [restore]);
  const signIn = useCallback(async (phone: string, password: string) => {
    const version = ++requestVersion.current;
    setState("loading");
    try {
      const login = await loginCustomer(phone, password);
      const identity = await getCustomerMe();
      if (version !== requestVersion.current) return;
      syncRef.current?.publishCsrf(login.csrfToken);
      setCustomer(identity);
      setState("authenticated");
    } catch (error) {
      if (version === requestVersion.current) {
        clearCustomerCsrf();
        setCustomer(null);
        setState("anonymous");
      }
      throw error;
    }
  }, []);
  const signOut = useCallback(async () => {
    requestVersion.current += 1;
    setCustomer(null);
    setState("anonymous");
    try {
      await logoutCustomer();
    } finally {
      syncRef.current?.publishLogout();
    }
  }, []);
  return <AuthContext value={{ state, customer, restore, signIn, signOut }}>{children}</AuthContext>;
}

function useCustomerAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("CustomerAuthProvider requerido");
  return value;
}

function AuthFrame({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <main className="customer-auth-page"><Container>
    <header className="customer-auth-header">
      <a href="/" className="app-brand"><BrandLogo variant="full" color="white" /></a>
      <ThemeSelector compact />
    </header>
    <div className="customer-auth-layout">
      <section className="customer-auth-intro">
        <p className="page-eyebrow">TU ESPACIO MI BICLA</p>
        <h1>{title}</h1><p>{description}</p>
        <div className="auth-art" aria-hidden="true"><span>QUERÉTARO · MTB</span></div>
      </section>
      <Card className="customer-auth-card">{children}</Card>
    </div>
  </Container></main>;
}

export function CustomerLogin() {
  const auth = useCustomerAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const result = new URLSearchParams(location.search).get("result");
  useEffect(() => {
    if (auth.state === "authenticated")
      location.replace(safeInternalDestination(new URLSearchParams(location.search).get("next")));
  }, [auth.state]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await auth.signIn(
        String(form.get("phone")),
        String(form.get("password")),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No fue posible iniciar sesión.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (auth.state === "loading" || auth.state === "authenticated")
    return <main className="customer-auth-page"><LoadingState label="Comprobando tu sesión…" /></main>;
  return <AuthFrame title="INICIA TU RUTA" description="Ingresa para consultar los datos disponibles de tu cuenta.">
    <form onSubmit={submit} aria-describedby={error ? "customer-login-error" : undefined}>
      <label>Teléfono<Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required /></label>
      <label>Contraseña<Input name="password" type="password" autoComplete="current-password" required /></label>
      {(result === "activation" || result === "recovery") && (
        <p className="form-notice" role="status">
          {result === "activation"
            ? "Tu cuenta quedó activada. Ya puedes iniciar sesión."
            : "Tu contraseña fue actualizada y las sesiones anteriores se cerraron."}
        </p>
      )}
      {error && <p id="customer-login-error" className="form-error" role="alert">{error}</p>}
      <Button disabled={busy}>{busy ? "Iniciando sesión…" : "Iniciar sesión"}</Button>
    </form>
    <footer><a href="/registro">¿Cómo activo mi cuenta?</a></footer>
  </AuthFrame>;
}

function PasswordTokenForm({ purpose }: { purpose: "activation" | "recovery" }) {
  const [token] = useState(() => takeTokenFromLocation(location, history));
  const [valid, setValid] = useState(purpose === "recovery" ? Boolean(token) : false);
  const [checking, setChecking] = useState(purpose === "activation" && Boolean(token));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState(token ? "" : "El enlace no es válido o ya no está disponible.");
  useEffect(() => {
    if (purpose !== "activation" || !token) return;
    const controller = new AbortController();
    validateActivation(token, controller.signal)
      .then(({ valid: result }) => {
        setValid(result);
        if (!result) setMessage("El enlace no es válido o ya no está disponible.");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof ApiError ? error.message : "No fue posible validar el enlace.");
      })
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [purpose, token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busyRef.current) return;
    busyRef.current = true;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      busyRef.current = false;
      setMessage("Las contraseñas no coinciden."); return;
    }
    setBusy(true); setMessage("");
    try {
      if (purpose === "activation") await activateCustomer(token, password);
      else await recoverCustomer(token, password);
      location.replace(`/iniciar-sesion?result=${purpose}`);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "El enlace no es válido o ya no está disponible.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const title = purpose === "activation" ? "ACTIVA TU CUENTA" : "RECUPERA TU ACCESO";
  return <AuthFrame title={title} description="Elige una contraseña segura para continuar.">
    {checking ? <LoadingState label="Validando enlace…" /> : valid ? <form onSubmit={submit} aria-describedby={message ? "token-form-message" : undefined}>
      <label>Nueva contraseña<Input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <label>Confirmar contraseña<Input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      {message && <p id="token-form-message" className="form-error" role="alert">{message}</p>}
      <Button disabled={busy}>{busy ? "Guardando…" : purpose === "activation" ? "Activar cuenta" : "Cambiar contraseña"}</Button>
    </form> : <p className="form-error" role="alert">{message}</p>}
    <footer><a href="/iniciar-sesion">Volver a iniciar sesión</a></footer>
  </AuthFrame>;
}

export const CustomerActivation = () => <PasswordTokenForm purpose="activation" />;
export const CustomerRecovery = () => <PasswordTokenForm purpose="recovery" />;

export function CustomerPortal() {
  const auth = useCustomerAuth();
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    if (auth.state === "anonymous") {
      const next = `${location.pathname}${location.search}`;
      location.replace(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
    }
    if (auth.state === "authenticated")
      getCustomerMe()
        .then((identity) => {
          if (current) setCustomer(identity);
        })
        .catch((caught) => {
          if (!current) return;
          if (caught instanceof ApiError && caught.status === 401)
            void auth.restore();
          else setError("No fue posible consultar tu cuenta.");
        });
    return () => {
      current = false;
    };
  }, [auth.state]);
  if (auth.state === "loading" || auth.state === "anonymous")
    return <main className="customer-auth-page"><LoadingState label="Preparando tu cuenta…" /></main>;
  if (auth.state === "error")
    return <AuthFrame title="NO PUDIMOS CARGAR TU CUENTA" description="Intenta nuevamente más tarde."><Button onClick={() => void auth.restore()}>Reintentar</Button></AuthFrame>;
  const identity = customer ?? auth.customer;
  return <div className="customer-shell">
    <header className="customer-topbar"><a href="/mi" className="app-brand"><BrandLogo variant="full" color="white" /></a><ThemeSelector compact /></header>
    <Container as="main"><section className="customer-account">
      <p className="page-eyebrow">PORTAL DEL CLIENTE</p>
      <h1>Hola{identity?.name ? `, ${identity.name.split(" ")[0]}` : ""}</h1>
      {error ? <p className="form-error" role="alert">{error}</p> : identity ? <Card>
        <h2>Datos de tu cuenta</h2>
        <dl><div><dt>Nombre</dt><dd>{identity.name}</dd></div><div><dt>Teléfono</dt><dd>{identity.phone}</dd></div><div><dt>Estado</dt><dd>Activa</dd></div></dl>
      </Card> : <LoadingState label="Consultando tus datos…" />}
      <Button variant="secondary" onClick={() => void auth.signOut().then(() => location.replace("/iniciar-sesion"))}>Cerrar sesión</Button>
    </section></Container>
  </div>;
}

export function CustomerRegistrationInfo() {
  return <AuthFrame title="ACTIVA TU CUENTA" description="La cuenta se vincula con un cliente que ya existe en Mi Bicla.">
    <h2>No hay registro público</h2>
    <p>Mi Bicla te proporciona un enlace de activación. Si ya activaste tu cuenta, puedes iniciar sesión.</p>
    <a className="ui-button" href="/iniciar-sesion">Iniciar sesión</a>
  </AuthFrame>;
}
