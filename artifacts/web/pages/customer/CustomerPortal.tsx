import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import { BrandLogo } from "../../components/brand";
import { Timeline } from "../../components/domain";
import { Container } from "../../components/primitives";
import { ThemeSelector } from "../../components/ThemeSelector";
import {
  BicyclesIcon,
  EventsIcon,
  FidelityAssetIcon,
  HomeAssetIcon,
  MoreIcon,
  OrdersIcon,
  ProductsIcon,
  RequestsIcon,
  SettingsIcon,
} from "../../components/nav-icons";
import { FeatureCard } from "../../components/brand";
import {
  Card,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingState,
  StatusBadge,
  Stepper,
  statusLabel,
} from "../../components/ui";
import {
  getMyBicycles,
  createMyBicycle,
  createMyCardLink,
  createMyWorkshopRequest,
  changeMyPassword,
  getMyLoyalty,
  getMyOrder,
  getMyOrders,
  getMyWorkshopRequests,
  getMyWorkshopFinancials,
  getCustomerTeams,
  getMyTeamAffiliation,
  requestMyTeamAffiliation,
  updateMyBicycle,
  updateMyProfile,
  type CustomerBicycle,
  type CustomerIdentity,
  type CustomerLoyalty,
  type CustomerOrderSummary,
  type CustomerOrderTracking,
  type CustomerBicyclePayload,
  type CustomerWorkshopFinancials,
} from "../../lib/customer-auth";
import { useCustomerAuth } from "./CustomerAuth";
import {
  BICYCLE_BRANDS,
  BICYCLE_COLORS,
  BICYCLE_CONDITIONS,
  BICYCLE_TYPES,
  BRAKE_TYPES,
  WHEEL_SIZES,
} from "../../lib/bicycle-catalogs";
import { CustomerCommerce } from "./CustomerCommerce";
import { workshopTimelineMessage } from "../../lib/workshop-timeline";
import { WorkshopRequestFlow } from "../../components/WorkshopRequestFlow";
import type { WorkshopRequestDraft } from "../../lib/workshop-request";

function NotificationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}

const NAV = [
  ["/mi", "Inicio", <HomeAssetIcon key="inicio" />],
  ["/mi/bicicletas", "Biclas", <BicyclesIcon key="bicicletas" />],
  ["/mi/ordenes", "Órdenes", <OrdersIcon key="ordenes" />],
  ["/mi/eventos", "Eventos", <EventsIcon key="eventos" />],
] as const;

const CUSTOMER_MENU = [
  ["Tu cuenta", [
    ["/mi", "Inicio", <HomeAssetIcon key="inicio" />],
    ["/mi/tarjeta", "Mi tarjeta", <FidelityAssetIcon key="tarjeta" />],
    ["/mi/perfil", "Mi perfil", <SettingsIcon key="perfil" />],
  ]],
  ["Taller", [
    ["/mi/bicicletas", "Mis bicicletas", <BicyclesIcon key="bicicletas" />],
    ["/mi/ordenes", "Órdenes", <OrdersIcon key="ordenes" />],
    ["/mi/solicitudes", "Solicitudes", <RequestsIcon key="solicitudes" />],
  ]],
  ["Descubre", [
    ["/mi/productos", "Productos", <ProductsIcon key="productos" />],
    ["/mi/eventos", "Eventos", <EventsIcon key="eventos" />],
  ]],
] as const;

function usePortalData<T>(key: string, loader: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setError(false); setLoading(true);
    loader(controller.signal).then(setData).catch((caught) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(true);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [key]);
  return { data, error, loading };
}

export function CustomerPortalShell({ identity, title, section, description, children }: {
  identity: CustomerIdentity | null;
  title: string;
  section: "home" | "loyalty" | "bikes" | "workshop" | "profile" | "products" | "events" | "requests";
  description: string;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuSheet = useRef<HTMLElement>(null);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const overflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = menuSheet.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => menuSheet.current?.querySelector<HTMLElement>("button")?.focus());
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeyDown);
      menuButton.current?.focus();
    };
  }, [menuOpen]);
  const activePath = ["/mi/taller", "/mi/orden"].includes(location.pathname)
    ? "/mi/ordenes"
    : location.pathname;
  const today = new Date();
  return <div className="customer-shell">
    <header className="customer-topbar">
      <a href="/mi" className="app-brand"><BrandLogo variant="full" color="white" /></a>
      <button type="button" className="customer-notifications" aria-label="Notificaciones" title={`Notificaciones de ${identity?.firstName || identity?.name || "Mi Bicla"}`}><NotificationIcon /></button>
    </header>
    <Container as="main" className="customer-portal-content">
      <header className={`customer-portal-hero customer-portal-hero--${section}`}><div>{section === "home" && <time dateTime={today.toISOString().slice(0, 10)}>{today.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}<span>{today.toLocaleDateString("es-MX", { weekday: "long" })}</span></time>}<p className="page-eyebrow">PORTAL DEL CLIENTE</p><h1>{title}</h1><p>{description}</p></div></header>
      {children}
    </Container>
    {menuOpen && <div className="customer-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
      <section ref={menuSheet} id="customer-menu" className="customer-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="customer-menu-title">
        <header><div><p className="page-eyebrow">PORTAL DEL CLIENTE</p><h2 id="customer-menu-title">Menú</h2></div><button type="button" aria-label="Cerrar menú" onClick={closeMenu}>×</button></header>
        <nav aria-label="Todos los destinos del cliente" onClick={(event) => { if ((event.target as Element).closest("a")) closeMenu(); }}>
          {CUSTOMER_MENU.map(([group, links]) => <section key={group} aria-labelledby={`customer-menu-${group.toLowerCase().replace(" ", "-")}`}><h3 id={`customer-menu-${group.toLowerCase().replace(" ", "-")}`}>{group}</h3>{links.map(([href, label, icon]) => <a key={href} href={href} aria-current={activePath === href ? "page" : undefined}><i aria-hidden="true">{icon}</i><span>{label}</span></a>)}</section>)}
        </nav>
      </section>
    </div>}
    <nav className="customer-bottom-nav" aria-label="Navegación del cliente">
      {NAV.map(([href, label, icon]) => <a key={href} href={href} aria-current={activePath === href ? "page" : undefined}><i aria-hidden="true">{icon}</i>{label}</a>)}
      <button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="customer-menu" aria-haspopup="dialog" onClick={() => setMenuOpen((current) => !current)}><i aria-hidden="true"><MoreIcon /></i>Menú</button>
    </nav>
  </div>;
}

const Shell = CustomerPortalShell;

function bicycleName(bicycle: { nickname?: string | null; brand?: string | null; model?: string | null }) {
  return bicycle.nickname || [bicycle.brand, bicycle.model].filter(Boolean).join(" ") || "Bicicleta";
}

function BicycleVisual({ bicycle, compact = false }: {
  bicycle?: { nickname?: string | null; brand?: string | null; model?: string | null } | null;
  compact?: boolean;
}) {
  return <div className={`customer-bicycle-visual${compact ? " is-compact" : ""}`} role="img" aria-label={bicycle ? bicycleName(bicycle) : "Bicicleta Mi Bicla"}><BrandLogo variant="symbol" color="pink" decorative /></div>;
}

function nextOrderAction(order?: CustomerOrderSummary | null) {
  if (!order) return "Agendar servicio";
  const status = order.publicStatus.toLowerCase();
  if (status.includes("autoriz")) return "Revisar autorización";
  if (status.includes("lista") || status.includes("ready")) return "Recoger bicicleta";
  if (status.includes("entreg") || status.includes("cancel")) return "Consultar historial";
  return "Ver seguimiento";
}

function requestStatusText(status: string) {
  const labels: Record<string, string> = {
    pending: "Solicitud recibida. El taller debe confirmarla.",
    reviewing: "El equipo está revisando tu solicitud.",
    accepted: "Solicitud aceptada. Pronto aparecerá como orden.",
    rejected: "La solicitud no pudo confirmarse.",
    cancelled: "Solicitud cancelada.",
    converted: "Solicitud convertida en orden de taller.",
  };
  return labels[status] ?? "Consulta el estado con el equipo Mi Bicla.";
}

function CustomerQrButton({ name, className = "" }: { name: string; className?: string }) {
  const [qr, setQr] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  async function showQr() {
    setOpen(true); setError("");
    if (qr) return;
    try {
      const { cardUrl } = await createMyCardLink();
      setQr(await QRCode.toDataURL(cardUrl, {
        width: 360,
        margin: 2,
        color: { dark: "#09090b", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }));
    } catch { setError("No fue posible generar tu QR."); }
  }
  return <>
    <Button className={className} type="button" onClick={() => void showQr()}>Ver mi QR</Button>
    {open && <Dialog open className="ui-modal customer-qr-modal" aria-labelledby="customer-qr-title"><section className="customer-qr-dialog"><p className="page-eyebrow">TARJETA MI BICLA</p><h2 id="customer-qr-title">Tu código QR</h2><p>El equipo lo escaneará para identificar tu cuenta.</p>{qr ? <img src={qr} alt={`Código QR de ${name}`} /> : error ? <p className="form-error">{error}</p> : <LoadingState label="Generando QR…" />}<Button type="button" data-dialog-close variant="secondary" onClick={() => setOpen(false)}>Cerrar</Button></section></Dialog>}
  </>;
}

function LoyaltyProgress({ loyalty, compact = false, action }: { loyalty: CustomerLoyalty; compact?: boolean; action?: ReactNode }) {
  const goal = loyalty.loyaltyProgram?.rewardUnits ?? 0;
  const points = loyalty.balance.availableUnits;
  const iconCount = Math.min(Math.max(goal, 0), 10);
  const earned = goal > 0
    ? Math.min(iconCount, Math.floor((Math.max(points, 0) / goal) * iconCount))
    : 0;
  const progress = iconCount > 0 && <div className="client-progress" aria-label={`${points} de ${goal} puntos`}>
    {Array.from({ length: iconCount }, (_, index) => <i key={index} className={index < earned ? "earned" : ""}><img src="/pink-simple.png" alt="" /></i>)}
  </div>;
  if (compact) return <section className="client-home-progress"><small>TU PROGRESO</small><div className="client-score"><strong>{String(points).padStart(2, "0")}</strong>{goal > 0 && <span>/ {goal}<small>puntos</small></span>}</div>{progress}<p>{goal > 0 ? `Faltan ${Math.max(goal - points, 0)} puntos para tu próxima recompensa.` : "El programa no tiene una meta configurada."}</p>{action}</section>;
  const nextReward = loyalty.rewards[0]?.rewardName || loyalty.loyaltyProgram?.rewardName || "Tu próxima recompensa";
  return <div className="customer-loyalty-cards">
    <section className="client-member-card"><header><span>MIEMBRO</span><BrandLogo variant="symbol" color="pink" decorative /></header><strong>MI BICLA</strong><small>{loyalty.name}</small></section>
    <section className="client-points-card"><small>PUNTOS ACTUALES</small><div className="client-score"><strong>{String(points).padStart(2, "0")}</strong><span>puntos</span></div>{progress}<p>{goal > 0 ? `Faltan ${Math.max(goal - points, 0)} puntos para tu próxima recompensa.` : "Sin meta configurada."}</p><div className="client-next-reward"><span aria-hidden="true">%</span><div><small>PRÓXIMA RECOMPENSA</small><strong>{nextReward}</strong></div><b aria-hidden="true">›</b></div></section>
  </div>;
}

function Home({ identity }: { identity: CustomerIdentity | null }) {
  const loyalty = usePortalData("loyalty", getMyLoyalty);
  const bicycles = usePortalData("bicycles", getMyBicycles);
  const orders = usePortalData("orders", getMyOrders);
  const activeOrder = orders.data?.find((order) => order.isActive);
  const firstName = identity?.firstName || identity?.name.split(" ")[0];
  return <Shell identity={identity} section="home" title={`Hola${firstName ? `, ${firstName}` : ""}`} description="Tu bicicleta y tus beneficios, en un solo lugar.">
    <div className="customer-dashboard">
      <section className="customer-home-workshop"><p className="page-eyebrow">TALLER</p><h2>{activeOrder ? "Orden activa" : "Sin orden activa"}</h2>
        <Card className="active-service customer-home-service">
          <header><span>{activeOrder ? "En servicio" : "Taller"}</span>{activeOrder && <StatusBadge status={activeOrder.publicStatus} />}</header>
          <div className="customer-home-bike"><BicycleVisual bicycle={activeOrder?.bicycle} compact /><div className="customer-home-bike-copy">{activeOrder && <p className="page-eyebrow">{activeOrder.orderNumber}</p>}<h2>{activeOrder ? bicycleName(activeOrder.bicycle) : "Tu próxima visita"}</h2>{activeOrder && <StatusBadge status={activeOrder.publicStatus} />}<p>{activeOrder?.customerVisibleSummary || "Agenda el servicio de tu bicicleta desde el portal."}</p></div></div>
          <a className="customer-primary-link" href="/mi/ordenes">{activeOrder ? "Ver seguimiento" : "Agendar servicio"}</a>
          {activeOrder && <a className="customer-secondary-link" href="/mi/ordenes">Agendar otro servicio</a>}
        </Card>
      </section>
      {loyalty.data ? <LoyaltyProgress loyalty={loyalty.data} compact action={<CustomerQrButton name={loyalty.data.name} className="client-home-qr-button" />} /> : loyalty.error ? <ErrorState message="No fue posible consultar tus puntos." /> : <LoadingState label="Consultando tus puntos…" />}
      <p className="customer-bike-count">{bicycles.error ? "No fue posible consultar tus bicicletas." : `${bicycles.data?.length ?? 0} bicicletas vinculadas a tu cuenta.`}</p>
      <nav className="customer-commerce-discovery brand-feature-grid" aria-label="Compra y eventos"><FeatureCard tone="black" icon={<ProductsIcon />} title="Productos" description="Explora y cotiza equipo" href="/mi/productos" /><FeatureCard tone="pink" icon={<EventsIcon />} title="Eventos" description="Consulta las próximas rodadas" href="/mi/eventos" /><FeatureCard tone="black" icon={<RequestsIcon />} title="Solicitudes" description="Consulta tus respuestas" href="/mi/solicitudes" /></nav>
    </div>
  </Shell>;
}

function Loyalty({ identity }: { identity: CustomerIdentity | null }) {
  const { data, error } = usePortalData("loyalty", getMyLoyalty);
  return <Shell identity={identity} section="loyalty" title="Mi tarjeta" description="Cada visita cuenta. Consulta tu avance y las recompensas listas para usar.">
    {error ? <ErrorState message="No fue posible consultar tu tarjeta." /> : !data ? <LoadingState label="Consultando tu tarjeta…" /> : <>
      <LoyaltyProgress loyalty={data} />
      <section className="customer-qr-action"><div><p className="page-eyebrow">IDENTIFÍCATE EN TIENDA</p><p>Muestra tu QR al equipo de Mi Bicla para acumular o canjear puntos.</p></div><CustomerQrButton name={data.name} /></section>
      <section className="customer-section"><p className="page-eyebrow">MOVIMIENTOS RECIENTES</p>{data.movements.length ? <div className="profile-menu">{data.movements.map((movement) => <div className="customer-movement" key={movement.id}><b className={movement.units >= 0 ? "is-positive" : ""}>{movement.units >= 0 ? "+" : ""}{movement.units}</b><span><strong>{movement.reason}</strong><small>{new Date(movement.createdAt).toLocaleDateString("es-MX")}</small></span></div>)}</div> : <EmptyState title="Aún no hay movimientos" description="Tus próximos movimientos de puntos aparecerán aquí." />}</section>
    </>}
  </Shell>;
}

function BicycleEditor({ bicycle, onClose, onSaved }: {
  bicycle: CustomerBicycle | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    nickname: bicycle?.nickname ?? "", brand: bicycle?.brand ?? "", model: bicycle?.model ?? "",
    bikeType: bicycle?.bikeType ?? "", color: bicycle?.color ?? "", wheelSize: bicycle?.wheelSize ?? "",
    year: bicycle?.year?.toString() ?? "", brakeType: bicycle?.brakeType ?? "",
    generalCondition: bicycle?.generalCondition ?? "", serialNumber: bicycle?.serialNumber ?? "",
    frameNumber: bicycle?.frameNumber ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const payload: CustomerBicyclePayload = {
      ...form,
      year: form.year ? Number(form.year) : null,
      nickname: form.nickname || null,
      brand: form.brand || null,
      model: form.model || null,
      bikeType: form.bikeType || null,
      color: form.color || null,
      wheelSize: form.wheelSize || null,
      brakeType: form.brakeType || null,
      generalCondition: form.generalCondition || null,
      serialNumber: form.serialNumber || null,
      frameNumber: form.frameNumber || null,
    };
    try {
      if (bicycle) await updateMyBicycle(bicycle.id, payload);
      else await createMyBicycle(payload);
      onSaved();
    } catch { setError("No fue posible guardar la bicicleta."); }
    finally { setBusy(false); }
  }
  const select = (label: string, field: keyof typeof form, options: string[]) => <label>{label}<select value={form[field]} onChange={(event) => set(field, event.target.value)}><option value="">Selecciona</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <FormDialog open aria-labelledby="customer-bike-title"><form className="customer-editor-form" onSubmit={submit}><header className="form-dialog-header"><p className="page-eyebrow">TU BICICLETA</p><h2 id="customer-bike-title">{bicycle ? "Editar bicicleta" : "Agregar bicicleta"}</h2></header><div className="form-dialog-body"><div className="customer-form-grid"><label>Apodo<input value={form.nickname} onChange={(event) => set("nickname", event.target.value)} /></label>{select("Marca", "brand", BICYCLE_BRANDS)}<label>Modelo<input value={form.model} onChange={(event) => set("model", event.target.value)} /></label>{select("Tipo", "bikeType", BICYCLE_TYPES)}{select("Color", "color", BICYCLE_COLORS)}{select("Rodada", "wheelSize", WHEEL_SIZES)}<label>Año<input type="number" min="1900" max="2100" value={form.year} onChange={(event) => set("year", event.target.value)} /></label>{select("Frenos", "brakeType", BRAKE_TYPES)}{select("Estado general", "generalCondition", BICYCLE_CONDITIONS)}<label>Número de serie<input value={form.serialNumber} onChange={(event) => set("serialNumber", event.target.value)} /></label><label>Número de cuadro<input value={form.frameNumber} onChange={(event) => set("frameNumber", event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="modal-actions form-dialog-actions"><Button type="button" data-dialog-close variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? "Guardando…" : "Guardar bicicleta"}</Button></div></form></FormDialog>;
}

function Bicycles({ identity }: { identity: CustomerIdentity | null }) {
  const [revision, setRevision] = useState(0);
  const { data, error } = usePortalData(`bicycles-${revision}`, getMyBicycles);
  const orders = usePortalData("bicycle-orders", getMyOrders);
  const [editing, setEditing] = useState<CustomerBicycle | "new" | null>(null);
  const saved = () => { setEditing(null); setRevision((current) => current + 1); };
  return <Shell identity={identity} section="bikes" title="Mis bicicletas" description="Registra cada bici y mantenla lista para su próximo servicio.">
    <div className="customer-section-heading customer-bikes-heading"><div><p className="page-eyebrow">TU GARAGE</p><h2>{data?.length ?? 0} bicicletas</h2></div><Button onClick={() => setEditing("new")}>+ Agregar bicicleta</Button></div>
    {error ? <ErrorState message="No fue posible consultar tus bicicletas." /> : !data ? <LoadingState label="Consultando tus bicicletas…" /> : data.length ? <div className="customer-bike-grid">
      {data.map((bike, index) => {
        const related = orders.data?.filter((order) => order.bicycle.id === bike.id) ?? [];
        const latest = related[0];
        return <article className="customer-bike-card" key={bike.id}><div className="customer-bike-media"><BicycleVisual bicycle={bike} />{index === 0 && <span>PRINCIPAL</span>}</div><div><small>{bike.brand || "MI BICLA"}</small><h2>{bike.nickname || bike.model || "Mi bicicleta"}</h2><p>{[bike.year && `Año ${bike.year}`, bike.wheelSize && `Rodada ${bike.wheelSize}`, bike.color && `Color ${bike.color}`].filter(Boolean).join(" · ") || "Completa los datos de tu bicicleta"}</p><dl><div><dt>Último servicio</dt><dd>{latest ? new Date(latest.updatedAt).toLocaleDateString("es-MX") : "Sin servicios"}<small>{latest ? "Servicio registrado" : "Agenda tu primera visita"}</small></dd></div><div><dt>Estado actual</dt><dd className={latest?.isActive ? "is-active" : ""}>{latest ? statusLabel(latest.publicStatus) : bike.generalCondition || "Activa"}<small>{latest?.isActive ? "Orden activa" : "Sin orden activa"}</small></dd></div></dl><div className="customer-bike-actions">{latest?.isActive && <a className="customer-bike-primary" href="/mi/ordenes">Ver orden activa <span aria-hidden="true">→</span></a>}<a className="customer-bike-secondary" href="/mi/ordenes">Agendar servicio</a><button type="button" onClick={() => setEditing(bike)}>Editar datos</button></div></div></article>;
      })}
    </div> : <EmptyState title="No tienes bicicletas registradas" description="Agrega tu primera bicicleta para solicitar servicios con tus datos guardados." />}
    {editing && <BicycleEditor bicycle={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />}
  </Shell>;
}

function Workshop({ identity }: { identity: CustomerIdentity | null }) {
  const [trackingRevision, setTrackingRevision] = useState(0);
  const { data: orders, error } = usePortalData(`orders-${trackingRevision}`, getMyOrders);
  const [requestRevision, setRequestRevision] = useState(0);
  const requests = usePortalData(`requests-${requestRevision}-${trackingRevision}`, getMyWorkshopRequests);
  const bicycles = usePortalData("workshop-bicycles", getMyBicycles);
  const financials = usePortalData("workshop-financials", getMyWorkshopFinancials);
  const [requestOpen, setRequestOpen] = useState(false);
  const [scope, setScope] = useState<"active" | "history">("active");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerOrderTracking | null>(null);
  const [detailError, setDetailError] = useState(false);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setTrackingRevision((current) => current + 1);
    };
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    const available = orders?.filter((order) => scope === "active" ? order.isActive : !order.isActive) ?? [];
    const orderNumber = selected ?? available[0]?.orderNumber;
    if (!orderNumber) { setDetail(null); return; }
    const controller = new AbortController();
    setDetailError(false);
    getMyOrder(orderNumber, controller.signal).then(setDetail).catch((caught) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setDetailError(true);
    });
    return () => controller.abort();
  }, [selected, orders, trackingRevision, scope]);
  const activeOrders = orders?.filter((order) => order.isActive) ?? [];
  const previousOrders = orders?.filter((order) => !order.isActive) ?? [];
  const scopedOrders = scope === "active" ? activeOrders : previousOrders;
  const orderButton = (order: CustomerOrderSummary) => <button type="button" key={order.orderNumber} onClick={() => { setScope(order.isActive ? "active" : "history"); setSelected(order.orderNumber); }} aria-pressed={(selected ?? scopedOrders[0]?.orderNumber) === order.orderNumber}><BicycleVisual bicycle={order.bicycle} compact /><span><strong>{bicycleName(order.bicycle)}</strong><small>{order.orderNumber} · {new Date(order.updatedAt).toLocaleDateString("es-MX")}</small><small>{nextOrderAction(order)}</small></span><StatusBadge status={order.publicStatus} /></button>;
  return <Shell identity={identity} section="workshop" title="Mi taller" description="Solicita un servicio y sigue cada avance sin folios ni tokens.">
    <div className="customer-order-tabs" role="tablist" aria-label="Filtrar órdenes"><button type="button" role="tab" aria-selected={scope === "active"} onClick={() => { setScope("active"); setSelected(null); setDetail(null); }}>Activas <span>{activeOrders.length}</span></button><button type="button" role="tab" aria-selected={scope === "history"} onClick={() => { setScope("history"); setSelected(null); setDetail(null); }}>Historial <span>{previousOrders.length}</span></button></div>
    {requests.error ? <ErrorState message="No fue posible consultar tus solicitudes." /> : !requests.data ? <LoadingState label="Consultando tus solicitudes…" /> : requests.data.length > 0 && <section className="customer-request-status"><div className="customer-section-heading"><div><p className="page-eyebrow">ANTES DE LA ORDEN</p><h2>Solicitudes</h2></div></div><div className="customer-request-grid">{requests.data.map((request) => <Card key={request.requestNumber}><div className="customer-request-card-heading"><p className="page-eyebrow">{request.requestNumber}</p><StatusBadge status={request.status} /></div><h3>{requestStatusText(request.status)}</h3><p>{request.problemDescription}</p><small>Enviada {new Date(request.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</small></Card>)}</div></section>}
    {error ? <ErrorState message="No fue posible consultar tus órdenes." /> : !orders ? <LoadingState label="Consultando tus órdenes…" /> : !scopedOrders.length ? <div className="customer-empty-action"><EmptyState title={scope === "active" ? "Aún no hay una orden activa" : "Aún no hay órdenes anteriores"} description={scope === "active" && requests.data?.length ? "Tu solicitud aparece arriba con su estado. Cuando el taller la confirme, el seguimiento se mostrará aquí." : "Tu historial de servicios aparecerá en esta sección."} />{scope === "active" && <Button onClick={() => setRequestOpen(true)} disabled={!bicycles.data?.length}>Agendar taller</Button>}</div> : <div className={`customer-two-column customer-order-layout${scopedOrders.length === 1 ? " is-single" : ""}`}>
      {scopedOrders.length > 1 && <section className="profile-menu customer-order-list" aria-label="Órdenes de taller">
        {scopedOrders.map(orderButton)}
      </section>}
      {detailError ? <ErrorState message="No fue posible abrir esta orden." /> : !detail ? <LoadingState label="Cargando seguimiento…" /> : <Card className="active-service customer-order-detail">
        <div className="customer-order-bike"><div><p className="page-eyebrow">ORDEN {detail.orderNumber}</p><h2>{bicycleName(detail.bicycle)}</h2><StatusBadge status={detail.publicStatus} /></div><BicycleVisual bicycle={detail.bicycle} compact /></div>
        {detail.customerVisibleSummary && <p>{detail.customerVisibleSummary}</p>}
        {detail.totalCents !== undefined && detail.totalCents > 0 && <p className="customer-order-total"><span>Total o estimación</span><strong>{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(detail.totalCents / 100)}</strong></p>}
        <Stepper status={detail.publicStatus} />
        <CustomerOrderFinancials orderNumber={detail.orderNumber} financials={financials.data} error={financials.error} />
        {detail.visibleServices.length > 0 && <section className="customer-section"><h2>Servicios</h2><ul>{detail.visibleServices.map((service) => <li key={service.id}>{service.serviceName} · {statusLabel(service.status)}</li>)}</ul></section>}
        {detail.visibleParts.length > 0 && <section className="customer-section"><h2>Piezas y refacciones</h2><ul>{detail.visibleParts.map((part) => <li key={part.id}>{[part.brand, part.partName].filter(Boolean).join(" ")} · {statusLabel(part.status)}</li>)}</ul></section>}
        {detail.updates.length + detail.history.length > 0 && <section className="customer-section"><h2>Actualizaciones</h2><Timeline items={[...detail.updates.map((update) => ({ id: update.id, title: update.title, message: update.message, createdAt: update.createdAt })), ...detail.history.map((event) => { const title = statusLabel(event.status); return { id: event.id, title, message: workshopTimelineMessage(event.publicMessage, title), createdAt: event.createdAt }; })].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())} /></section>}
        <Button className="customer-order-follow" onClick={() => setTrackingRevision((current) => current + 1)}>Actualizar seguimiento <span aria-hidden="true">→</span></Button>
      </Card>}
    </div>}
    {scope === "active" && previousOrders.length > 0 && <section className="customer-previous-orders"><p className="page-eyebrow">ÓRDENES ANTERIORES</p><div className="profile-menu customer-order-list">{previousOrders.map(orderButton)}</div></section>}
    {requestOpen && <WorkshopRequestEditor bicycles={bicycles.data ?? []} onClose={() => setRequestOpen(false)} onSaved={() => { setRequestOpen(false); setRequestRevision((current) => current + 1); }} />}
  </Shell>;
}

function CustomerOrderFinancials({ orderNumber, financials, error }: { orderNumber: string; financials: CustomerWorkshopFinancials | null; error: boolean }) {
  if (error) return <p className="form-error">No fue posible consultar el estado financiero.</p>;
  if (!financials) return <LoadingState label="Consultando pagos…" />;
  const summary = financials.summaries.find((item) => item.orderNumber === orderNumber);
  const movements = financials.movements.filter((item) => item.orderNumber === orderNumber);
  if (!summary && !movements.length) return null;
  const money = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
  const labels: Record<string, string> = { advance: "Anticipo", payment: "Pago", discount: "Descuento", credit_applied: "Favor aplicado", charge: "Cargo", refund: "Reembolso", correction: "Reversión" };
  return <section className="customer-order-financials"><h2>Cuenta de la orden</h2>{summary && <dl><div><dt>Total</dt><dd>{money(summary.totalCents)}</dd></div><div><dt>Pagado</dt><dd>{money(summary.paidCents)}</dd></div><div><dt>Descuento</dt><dd>{money(summary.discountCents)}</dd></div><div><dt>Pendiente</dt><dd>{money(summary.pendingCents)}</dd></div>{summary.favorCents > 0 && <div><dt>A favor</dt><dd>{money(summary.favorCents)}</dd></div>}</dl>}<h3>Movimientos</h3>{movements.length ? <div className="customer-finance-movements">{movements.map((movement) => <div key={movement.id}><span><strong>{labels[movement.type] ?? movement.type}</strong><small>{movement.occurredDate}{movement.reference ? ` · ${movement.reference}` : ""}</small></span><b>{money(movement.amountCents)}</b></div>)}</div> : <p>Aún no hay movimientos registrados.</p>}</section>;
}

function WorkshopRequestEditor({ bicycles, onClose, onSaved }: { bicycles: CustomerBicycle[]; onClose: () => void; onSaved: () => void }) {
  async function submit(draft: WorkshopRequestDraft) {
    await createMyWorkshopRequest({ bicycleId: draft.bicycleId, catalogServiceId: draft.catalogServiceId || null,
      serviceName: draft.serviceName || null, problemDescription: draft.problemDescription, symptoms: draft.symptoms || null,
      visibleDamage: draft.visibleDamage || null, additionalComments: draft.additionalComments || null,
      requestedDate: draft.requestedDate || null, requestedTime: draft.requestedTime || null,
      desiredDeliveryDate: draft.desiredDeliveryDate || null, urgency: draft.urgency,
      preferredContactMethod: draft.preferredContactMethod });
    onSaved();
  }
  return <FormDialog open aria-labelledby="customer-request-title"><section className="customer-editor-form"><header className="form-dialog-header"><p className="page-eyebrow">TALLER MI BICLA</p><h2 id="customer-request-title">Solicitar servicio</h2></header><div className="form-dialog-body"><WorkshopRequestFlow authenticated bicycles={bicycles.map((bike) => ({ id: bike.id, label: bicycleName(bike) }))} initial={{ bicycleId: bicycles[0]?.id ?? "" }} onSubmit={submit} onCancel={onClose} /></div></section></FormDialog>;
}

function Profile({ identity, signOut }: { identity: CustomerIdentity | null; signOut: () => Promise<void> }) {
  const auth = useCustomerAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: identity?.firstName ?? identity?.name.split(" ")[0] ?? "", lastName: identity?.lastName ?? identity?.name.split(" ").slice(1).join(" ") ?? "", email: identity?.email ?? "", birthDate: identity?.birthDate ?? "" });
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirmation: "" });
  const [passwordNotice, setPasswordNotice] = useState("");
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setNotice(""); try { await updateMyProfile({ ...form, email: form.email || null, birthDate: form.birthDate || null }); await auth.restore(); setEditing(false); setNotice("Perfil actualizado."); } catch { setNotice("No fue posible actualizar tu perfil."); } finally { setBusy(false); } }
  async function savePassword(event: FormEvent) { event.preventDefault(); setPasswordNotice(""); if (passwords.next !== passwords.confirmation) { setPasswordNotice("Las contraseñas no coinciden."); return; } setBusy(true); try { await changeMyPassword(passwords.current, passwords.next); setPasswords({ current: "", next: "", confirmation: "" }); setPasswordNotice("Contraseña actualizada."); } catch { setPasswordNotice("La contraseña actual no coincide o la nueva no cumple los requisitos."); } finally { setBusy(false); } }
  return <Shell identity={identity} section="profile" title="Mi perfil" description="Mantén tus datos al día para que podamos acompañar mejor cada servicio."><section className="customer-profile-page">
    <header className="customer-profile-identity"><span aria-hidden="true">{identity?.name.charAt(0).toUpperCase() || "M"}</span><div><h1>{identity?.name || "Mi cuenta"}</h1><p>Miembro Mi Bicla</p></div></header>
    <p className="customer-profile-label">CUENTA</p><Card className="customer-profile-contact"><div className="customer-section-heading"><p className="page-eyebrow">DATOS DE CONTACTO</p><button type="button" onClick={() => setEditing(!editing)}>{editing ? "Cancelar" : "Editar"}</button></div>{editing ? <form className="customer-profile-form" onSubmit={save}><label>Nombre<input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label>Apellidos<input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Fecha de nacimiento<input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label><Button disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</Button></form> : identity && <dl><div><dt><span aria-hidden="true">☎</span> Teléfono</dt><dd>{identity.phone} <small>Verificado</small></dd></div><div><dt><span aria-hidden="true">✉</span> Correo electrónico</dt><dd>{identity.email || "Sin correo registrado"}</dd></div>{identity.birthDate && <div><dt>Fecha de nacimiento</dt><dd>{new Date(`${identity.birthDate}T00:00:00`).toLocaleDateString("es-MX")}</dd></div>}</dl>}{notice && <p role="status">{notice}</p>}</Card>
    <TeamAffiliation />
    <Card className="customer-profile-settings"><div><span aria-hidden="true">◐</span><ThemeSelector /></div><details><summary><span aria-hidden="true">▣</span> Cambiar contraseña <b aria-hidden="true">›</b></summary><form className="customer-profile-form" onSubmit={savePassword}><label>Contraseña actual<input type="password" autoComplete="current-password" required value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} /></label><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} required value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} /></label><label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} required value={passwords.confirmation} onChange={(event) => setPasswords({ ...passwords, confirmation: event.target.value })} /></label><Button disabled={busy}>Actualizar contraseña</Button>{passwordNotice && <p role="status">{passwordNotice}</p>}</form></details></Card>
    <p className="customer-profile-label">AYUDA</p><nav className="customer-profile-links" aria-label="Ayuda"><a href="/#contacto"><span aria-hidden="true">?</span>Centro de ayuda <b aria-hidden="true">›</b></a></nav>
    <button className="customer-sign-out" type="button" onClick={() => void signOut().then(() => location.replace("/iniciar-sesion"))}>Cerrar sesión</button>
  </section></Shell>;
}

function TeamAffiliation() {
  const [revision, setRevision] = useState(0);
  const teams = usePortalData("profile-teams", getCustomerTeams);
  const affiliation = usePortalData(`profile-affiliation-${revision}`, getMyTeamAffiliation);
  const [selection, setSelection] = useState("");
  const [proposedName, setProposedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setNotice("");
    if (!selection || (selection === "other" && !proposedName.trim())) return setNotice("Selecciona un equipo o escribe su nombre.");
    setBusy(true);
    try { await requestMyTeamAffiliation(selection === "other" ? { proposedTeamName: proposedName.trim() } : { teamId: selection }); setNotice("Solicitud enviada para revisión. No se aplicó ningún descuento automático."); setRevision((current) => current + 1); }
    catch { setNotice("No fue posible enviar la solicitud."); }
    finally { setBusy(false); }
  }
  return <Card className="customer-team-affiliation"><p className="page-eyebrow">EQUIPO O CLUB</p>{teams.error || affiliation.error ? <ErrorState message="No fue posible consultar tu afiliación." /> : teams.loading || affiliation.loading ? <LoadingState label="Consultando afiliación…" /> : affiliation.data ? <div><h3>{affiliation.data.team?.name ?? affiliation.data.affiliation.proposedTeamName}</h3><StatusBadge status={affiliation.data.affiliation.status} /><p>{affiliation.data.affiliation.status === "pending" ? "El equipo Mi Bicla revisará tu solicitud. Esto no aplica descuentos automáticamente." : "Afiliación verificada. Los convenios válidos se aplican únicamente al registrar una orden."}</p></div> : <form className="customer-profile-form" onSubmit={submit}><p>Solicita vincular tu cuenta. El taller debe verificarla antes de usar cualquier convenio.</p><label>Equipo<select required value={selection} onChange={(event) => setSelection(event.target.value)}><option value="">Selecciona</option>{teams.data?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}<option value="other">Otro</option></select></label>{selection === "other" && <label>Nombre propuesto<input required maxLength={200} value={proposedName} onChange={(event) => setProposedName(event.target.value)} /></label>}<Button disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</Button></form>}{notice && <p role="status">{notice}</p>}</Card>;
}

export function CustomerPortal() {
  const auth = useCustomerAuth();
  useEffect(() => {
    if (auth.state === "anonymous") {
      const next = `${location.pathname}${location.search}`;
      location.replace(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
    }
  }, [auth.state]);
  if (auth.state === "loading" || auth.state === "anonymous") return <main className="customer-auth-page"><LoadingState label="Preparando tu cuenta…" /></main>;
  if (auth.state === "error") return <main className="customer-auth-page"><ErrorState message="No pudimos cargar tu cuenta." onRetry={() => void auth.restore()} /></main>;
  const identity = auth.customer;
  if (location.pathname === "/mi/tarjeta") return <Loyalty identity={identity} />;
  if (location.pathname === "/mi/bicicletas") return <Bicycles identity={identity} />;
  if (["/mi/taller", "/mi/orden", "/mi/ordenes"].includes(location.pathname)) return <Workshop identity={identity} />;
  if (location.pathname === "/mi/perfil") return <Profile identity={identity} signOut={auth.signOut} />;
  if (location.pathname === "/mi/productos") return <CustomerCommerce identity={identity} page="products" Shell={Shell} />;
  if (location.pathname === "/mi/eventos") return <CustomerCommerce identity={identity} page="events" Shell={Shell} />;
  if (location.pathname === "/mi/solicitudes") return <CustomerCommerce identity={identity} page="requests" Shell={Shell} />;
  return <Home identity={identity} />;
}
