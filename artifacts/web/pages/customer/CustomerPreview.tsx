import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, Input } from "../../components/ui";
import { Container } from "../../components/primitives";
import { ThemeSelector } from "../../components/ThemeSelector";
import { BrandLogo } from "../../components/brand";

function DemoNotice({ compact = false }: { compact?: boolean }) {
  return <div className={`customer-demo-notice${compact ? " is-compact" : ""}`} role="note"><strong>DEMO</strong>{!compact && <span>La cuenta y autenticación de clientes todavía no está habilitada.</span>}</div>;
}

export function CustomerAuthPreview({ mode }: { mode: "register" | "login" | "recovery" }) {
  const [notice, setNotice] = useState("");
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const register = mode === "register";
  const recovery = mode === "recovery";
  function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("Vista visual: no se guardó ni envió ningún dato.");
  }
  return <main className="customer-auth-page"><Container>
    <header className="customer-auth-header"><a href="/" className="app-brand"><BrandLogo variant="full" color="white" /></a><ThemeSelector compact /></header>
    <div className="customer-auth-layout">
      <section className="customer-auth-intro"><p className="page-eyebrow">{register ? `${registerStep} DE 2 · ${registerStep === 1 ? "DATOS PERSONALES" : "SEGURIDAD"}` : "TU ESPACIO MI BICLA"}</p><h1>{register ? "CREA TU CUENTA" : recovery ? "RECUPERA TU ACCESO" : "INICIA TU RUTA"}</h1><p>{register ? "Todo sobre tu bici, siempre contigo." : recovery ? "Recupera tu cuenta mediante un código enviado a tu teléfono." : "Ingresa para continuar con tus bicicletas, puntos y taller."}</p><div className="auth-art" aria-hidden="true"><span>QUERÉTARO · MTB</span></div></section>
      <Card className="customer-auth-card"><DemoNotice /><form onSubmit={submit}>
        {register && registerStep === 1 && <><label>Nombre<Input name="name" autoComplete="name" required /></label><label>Teléfono<Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Tu número a 10 dígitos" required /></label><Button type="button" onClick={() => setRegisterStep(2)}>Continuar</Button></>}
        {register && registerStep === 2 && <><label>Contraseña<Input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirmar contraseña<Input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></label><label className="privacy-check"><input type="checkbox" required />Acepto el aviso de privacidad</label><div className="register-step-actions"><Button type="button" variant="secondary" onClick={() => setRegisterStep(1)}>Atrás</Button><Button>Crear cuenta</Button></div></>}
        {!register && <><label>Teléfono<Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Tu número a 10 dígitos" required /></label>{!recovery && <label>Contraseña<Input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>}<Button>{recovery ? "Solicitar código" : "Iniciar sesión"}</Button></>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
      </form>
      <footer>{register ? <>¿Ya tienes cuenta? <a href="/iniciar-sesion">Inicia sesión</a></> : recovery ? <a href="/iniciar-sesion">Volver a iniciar sesión</a> : <><a href="/recuperar-acceso">Olvidé mi contraseña</a><span>¿Aún no tienes cuenta? <a href="/registro">Crear cuenta</a></span></>}</footer></Card>
    </div>
  </Container></main>;
}

export function CustomerVerifyPreview() {
  const [notice, setNotice] = useState("");
  return <main className="customer-auth-page"><Container><header className="customer-auth-header"><a href="/" className="app-brand"><BrandLogo variant="full" color="white" /></a><span className="page-eyebrow">PASO 2 DE 2</span></header><div className="customer-auth-layout"><section className="customer-auth-intro"><p className="page-eyebrow">VERIFICACIÓN</p><h1>VERIFICA TU TELÉFONO</h1><p>En esta demostración no se envió ningún código por WhatsApp.</p><div className="auth-art" aria-hidden="true"><span>SEGURIDAD MI BICLA</span></div></section><Card className="customer-auth-card"><DemoNotice /><form onSubmit={(event) => { event.preventDefault(); setNotice("Vista visual: no se verificó ningún código."); }}><fieldset className="otp-fieldset"><legend>Código de seis dígitos</legend><div>{Array.from({ length: 6 }, (_, index) => <Input key={index} aria-label={`Dígito ${index + 1}`} inputMode="numeric" maxLength={1} autoComplete={index === 0 ? "one-time-code" : "off"} />)}</div></fieldset><Button>Verificar</Button><button className="auth-link-button" type="button">Reenviar código</button><a href="/registro">Corregir teléfono</a>{notice && <p role="status" className="form-notice">{notice}</p>}</form></Card></div></Container></main>;
}

const CLIENT_NAV = [
  ["/mi", "Inicio", "⌂"],
  ["/mi/tarjeta", "Tarjeta", "♡"],
  ["/mi/taller", "Taller", "◇"],
  ["/mi/perfil", "Más", "•••"],
] as const;

function CustomerShell({ title, children }: { title: string; children: ReactNode }) {
  const path = window.location.pathname;
  return <div className="customer-shell"><header className="customer-topbar"><a href="/mi" className="app-brand"><BrandLogo variant="full" color="white" /></a><div><span aria-hidden="true">D</span><ThemeSelector compact /></div></header><Container as="main"><header className="customer-page-title"><div><p className="page-eyebrow">PORTAL DEL CLIENTE</p><DemoNotice compact /></div><h1>{title}</h1></header>{children}</Container><nav className="customer-bottom-nav" aria-label="Navegación del cliente">{CLIENT_NAV.map(([href, label, icon]) => <a key={href} href={href} aria-current={path === href ? "page" : undefined}><i aria-hidden="true">{icon}</i>{label}</a>)}</nav></div>;
}

function ProgressDots({ earned = 6 }: { earned?: number }) {
  return <div className="client-progress" aria-label={`${earned} de 10 visitas`}>{Array.from({ length: 10 }, (_, i) => <i className={i < earned ? "earned" : ""} key={i}><img src="/pink-simple.png" alt="" /></i>)}</div>;
}

export function CustomerHomePreview() {
  return <CustomerShell title="HOLA, KARI"><div className="customer-dashboard"><section className="client-wallet"><small>TARJETA MI BICLA · DEMO</small><h2>6 DE 10 VISITAS</h2><ProgressDots /><p><span>Próxima recompensa</span><strong>Faltan 4 visitas</strong></p></section><section className="customer-quick-grid"><a href="/mi/tarjeta"><span>⌗</span>Ver mi QR</a><a href="/taller/solicitud"><span>◇</span>Agendar taller</a><a href="/mi/bicicletas"><span>♧</span>Mis bicicletas</a><a href="/depositos"><span>▤</span>Ver depósitos</a></section><div className="customer-two-column"><Card className="active-service"><header><span>En servicio</span><small>Datos demostrativos</small></header><h2>Bicicleta de demostración</h2><p>Diagnóstico completado</p><div className="mini-timeline"><i className="done" /><i className="done" /><i /><i /></div><a href="/mi/taller">Ver seguimiento</a></Card><Card><p className="page-eyebrow">TUS BICICLETAS</p><h2>Vista demostrativa</h2><p>Organiza tus bicicletas y selecciónalas al solicitar un servicio.</p><a href="/mi/bicicletas">Ver bicicletas</a></Card></div></div></CustomerShell>;
}

export function CustomerCardPreview() {
  return <CustomerShell title="Mi tarjeta"><section className="client-wallet client-wallet--large"><small>MIEMBRO MI BICLA · DEMO</small><h2>Tu progreso</h2><strong>6 <span>/ 10 visitas</span></strong><ProgressDots /><p><span>Próxima recompensa</span><strong>Faltan 4 visitas</strong></p><Button type="button" onClick={() => alert("Vista demostrativa: el QR se generará bajo demanda cuando exista autenticación.")}>Ver mi QR</Button></section><section className="customer-section"><h2>Actividad</h2><Card><p>El historial aparecerá aquí cuando la cuenta esté conectada.</p></Card></section></CustomerShell>;
}

export function CustomerWorkshopPreview() {
  return <CustomerShell title="Mi taller"><div className="customer-two-column"><Card className="active-service"><p className="page-eyebrow">Orden demostrativa</p><h2>Servicio en proceso</h2><p>Bicicleta de montaña</p><ol className="client-workshop-steps">{["Recibida", "Diagnóstico", "En servicio", "Lista", "Entregada"].map((step, i) => <li key={step} className={i < 3 ? "done" : ""}>{step}</li>)}</ol><a href="/taller/solicitud">Solicitar servicio</a></Card><Card><h2>Solicitudes</h2><p>No hay solicitudes reales conectadas en esta vista.</p></Card></div></CustomerShell>;
}

export function CustomerBikesPreview() {
  return <CustomerShell title="Mis bicicletas"><div className="customer-two-column"><Card className="demo-bike"><span aria-hidden="true">♧</span><div><small>BICICLETA DEMOSTRATIVA</small><h2>Mi bici de montaña</h2><p>Marca y modelo de ejemplo</p></div></Card><Card className="bike-form-preview"><h2>Registrar bicicleta</h2><p>El formulario permitirá capturar apodo, marca, modelo, tipo, rodada, color y una foto opcional cuando exista autenticación.</p><Button type="button" disabled>Agregar bicicleta</Button></Card></div></CustomerShell>;
}

export function CustomerProfilePreview() {
  return <CustomerShell title="Más"><div className="profile-menu"><a href="/mi/bicicletas">Mis bicicletas <span>›</span></a><a href="/depositos">Métodos de depósito <span>›</span></a><a href="/#ubicacion">Ubicación y horarios <span>›</span></a><button type="button" disabled>Cerrar sesión</button></div></CustomerShell>;
}
