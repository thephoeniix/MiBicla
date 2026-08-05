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
import { apiFetch, ApiError } from "../../lib/api-client";
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
import { buildRegistrationWhatsappUrl } from "../../lib/customer-registration";
import { isValidMexicanPhone } from "../../lib/mexican-phone";
import {
  isRegistrationPasswordValid,
  registrationPasswordStatus,
} from "../../lib/registration-password";

const PHONE_ERROR = "Ingresa un teléfono mexicano válido de 10 dígitos.";

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
    // Una página restaurada desde bfcache (navegación atrás/adelante) puede
    // seguir mostrando en el DOM datos privados de una sesión ya cerrada.
    // restore() invalida esa vista de inmediato (pasa a "loading") y vuelve a
    // preguntar al servidor si la sesión sigue siendo válida — sin recargar
    // la página completa.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void restore();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      requestVersion.current += 1;
      syncRef.current?.close();
      syncRef.current = null;
      window.removeEventListener("pageshow", onPageShow);
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
  const [phoneError, setPhoneError] = useState("");
  const busyRef = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const result = new URLSearchParams(location.search).get("result");
  useEffect(() => {
    if (auth.state === "authenticated")
      location.replace(safeInternalDestination(new URLSearchParams(location.search).get("next")));
  }, [auth.state]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone"));
    if (!isValidMexicanPhone(phone)) {
      setPhoneError(PHONE_ERROR);
      setError("");
      requestAnimationFrame(() => phoneRef.current?.focus());
      return;
    }
    setPhoneError("");
    busyRef.current = true;
    setBusy(true); setError("");
    try {
      await auth.signIn(phone, String(form.get("password")));
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
      <label>
        Teléfono
        <Input
          ref={phoneRef}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="442 000 0000"
          aria-invalid={Boolean(phoneError)}
          aria-describedby={phoneError ? "customer-login-phone-error" : undefined}
          onChange={() => { if (phoneError) setPhoneError(""); }}
          required
        />
        {phoneError && <small id="customer-login-phone-error" className="field-error">{phoneError}</small>}
      </label>
      <label>Contraseña<Input name="password" type="password" autoComplete="current-password" required /></label>
      {(result === "activation" || result === "recovery") && (
        <p className="form-notice" role="status">
          {result === "activation"
            ? "Tu cuenta está lista. Ya puedes iniciar sesión."
            : "Tu contraseña fue actualizada y las sesiones anteriores se cerraron."}
        </p>
      )}
      {error && <p id="customer-login-error" className="form-error" role="alert">{error}</p>}
      <Button disabled={busy}>{busy ? "Iniciando sesión…" : "Iniciar sesión"}</Button>
    </form>
    <footer>
      <p>¿Aún no tienes cuenta? Solicítala y verificaremos tu número.</p>
      <a href="/registro">Crear cuenta</a>
    </footer>
  </AuthFrame>;
}

function PasswordTokenForm({ purpose }: { purpose: "activation" | "recovery" }) {
  const [token] = useState(() => takeTokenFromLocation(location, history));
  const [valid, setValid] = useState(purpose === "recovery" ? Boolean(token) : false);
  const [checking, setChecking] = useState(purpose === "activation" && Boolean(token));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState(token ? "" : "El enlace no es válido o ya no está disponible.");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
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
    const validPassword = isRegistrationPasswordValid(password);
    const matches = password === confirmation;
    setPasswordError(validPassword ? "" : "Completa todos los requisitos de seguridad.");
    setConfirmationError(matches ? "" : "Las contraseñas no coinciden.");
    if (!validPassword) {
      passwordRef.current?.focus();
      return;
    }
    if (!matches) {
      confirmationRef.current?.focus();
      return;
    }
    busyRef.current = true;
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
  const passwordRequirements = registrationPasswordStatus(password);
  return <AuthFrame title={title} description="Elige una contraseña segura para continuar.">
    {checking ? <LoadingState label="Validando enlace…" /> : valid ? <form onSubmit={submit} aria-describedby={message ? "token-form-message" : undefined}>
      <label className="registration-password-control">
        <span>Nueva contraseña</span>
        <span className="password-field">
          <Input
            ref={passwordRef}
            required
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={`token-password-help${passwordError ? " token-password-error" : ""}`}
            onChange={(event) => {
              const next = event.target.value;
              setPassword(next);
              if (isRegistrationPasswordValid(next)) setPasswordError("");
              if (!confirmation || next === confirmation) setConfirmationError("");
            }}
          />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {showPassword ? "Ocultar" : "Ver"}
          </button>
        </span>
        <ul id="token-password-help" className="password-requirements" aria-label="Requisitos de contraseña">
          {passwordRequirements.map((requirement) => (
            <li key={requirement.id} className={requirement.met ? "is-met" : password ? "is-missing" : ""}>
              <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
              {requirement.label}
            </li>
          ))}
        </ul>
        {passwordError && <small id="token-password-error" className="field-error">{passwordError}</small>}
      </label>
      <label className="registration-password-control">
        <span>Confirmar contraseña</span>
        <span className="password-field">
          <Input
            ref={confirmationRef}
            required
            type={showConfirmation ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={confirmation}
            aria-invalid={Boolean(confirmationError)}
            aria-describedby={confirmationError ? "token-confirmation-error" : undefined}
            onChange={(event) => {
              const next = event.target.value;
              setConfirmation(next);
              if (next === password) setConfirmationError("");
            }}
          />
          <button type="button" onClick={() => setShowConfirmation((visible) => !visible)} aria-label={showConfirmation ? "Ocultar confirmación" : "Mostrar confirmación"}>
            {showConfirmation ? "Ocultar" : "Ver"}
          </button>
        </span>
        {confirmationError && <small id="token-confirmation-error" className="field-error">Las contraseñas no coinciden.</small>}
      </label>
      {message && <p id="token-form-message" className="form-error" role="alert">{message}</p>}
      <Button disabled={busy}>{busy ? "Guardando…" : purpose === "activation" ? "Activar mi cuenta" : "Cambiar contraseña"}</Button>
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [result, setResult] = useState<null | {
    reference: string; adminReviewUrl: string; expiresAt: string; name: string;
  }>(null);
  const [whatsapp, setWhatsapp] = useState("");
  useEffect(() => {
    apiFetch<{ primaryWhatsapp?: string }>("/api/public/business")
      .then((business) => setWhatsapp(business.primaryWhatsapp?.replace(/\D/g, "") ?? ""))
      .catch(() => setWhatsapp(""));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setBusy(true); setMessage("");
    try {
      const created = await apiFetch<{ reference: string; adminReviewUrl: string; expiresAt: string }>(
        "/api/public/customer-registration",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName, lastName: form.lastName, phone: form.phone,
          }),
        },
      );
      setResult({ ...created, name: `${form.firstName} ${form.lastName}`.trim() });
      setForm({ firstName: "", lastName: "", phone: "" });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "No fue posible enviar la solicitud.");
    } finally { setBusy(false); }
  }
  if (result) {
    const whatsappUrl = buildRegistrationWhatsappUrl(whatsapp, result);
    return <AuthFrame title="SOLICITUD RECIBIDA" description="Recibimos tu solicitud. Mi Bicla verificará tu número y te enviará por WhatsApp un enlace para crear tu contraseña.">
      <section className="registration-result">
        <p className="page-eyebrow">Estado pendiente</p>
        <h2>Referencia {result.reference}</h2>
        <p>Envía la solicitud por WhatsApp para que el equipo pueda revisarla. Abrir el enlace no aprueba la cuenta.</p>
        {whatsappUrl && <a className="ui-button" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar solicitud por WhatsApp</a>}
        {!whatsappUrl && <p>Comunícate directamente con Mi Bicla e indica tu referencia.</p>}
        <a className="ui-button ui-button--secondary" href="/iniciar-sesion">Iniciar sesión</a>
      </section>
    </AuthFrame>;
  }
  return <AuthFrame title="SOLICITA TU ACCESO" description="Completa tus datos. Mi Bicla verificará tu número antes de activar tu cuenta.">
    <form className="registration-form" onSubmit={submit} noValidate>
      <label>Nombre<Input required maxLength={100} autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
      <label>Apellidos<Input required maxLength={100} autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
      <label>Teléfono<Input required type="tel" inputMode="tel" autoComplete="tel" placeholder="442 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
      <label className="privacy-check"><input required type="checkbox" /> Confirmo que estos datos son míos y solicito que Mi Bicla los revise.</label>
      {message && <p className="form-error registration-server-error" role="alert">{message}</p>}
      <Button disabled={busy}>{busy ? "Enviando…" : "Solicitar cuenta"}</Button>
      <footer><a href="/iniciar-sesion">Iniciar sesión</a></footer>
    </form>
  </AuthFrame>;
}
