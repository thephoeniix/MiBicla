import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { BicycleForm, type Bicycle } from "../../components/BicycleForm";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "../../components/SearchableCombobox";
import {
  formatMxn,
  parseMxnToCents,
  WorkshopServices,
} from "../../components/WorkshopServices";
import {
  Button,
  Card,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  PageSection,
  StatusBadge,
  Stepper,
  Tabs,
  statusLabel,
  Toast,
} from "../../components/ui";
import { Drawer, WorkshopOrderCard } from "../../components/domain";
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}
interface RequestItem {
  id: string;
  requestNumber: string;
  customerName: string;
  customerPhone: string;
  problemDescription: string;
  status: string;
}
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  bicycleId: string;
  problemDescription: string;
  customerVisibleSummary: string | null;
}
interface OrderPart {
  id: string;
  partName: string;
  quantity: number;
  unitPriceCents?: number;
  status: string;
  isCustomerVisible: boolean;
}
const ORDER_EMPTY = {
  customerId: "",
  bicycleId: "",
  problemDescription: "",
  priority: "normal",
  initialDiagnosis: null,
  internalNotes: null,
  customerVisibleSummary: null,
  estimatedCompletionAt: null,
  assignedTo: null,
  discountCents: 0,
};
const ORDER_STATES = [
  "received", "inspection", "in_progress", "waiting_parts", "quality_check",
  "ready", "delivered",
] as const;
const PRIMARY_TRANSITION: Record<string, string | undefined> = {
  received: "inspection",
  inspection: "in_progress",
  in_progress: "quality_check",
  waiting_parts: "in_progress",
  quality_check: "ready",
  ready: "delivered",
};
const TRANSITION_LABEL: Record<string, string> = {
  inspection: "Iniciar inspección",
  in_progress: "Iniciar reparación",
  quality_check: "Iniciar control de calidad",
  ready: "Marcar como lista",
  delivered: "Entregar bicicleta",
};
const STATUS_PROGRESS: Record<string, number> = {
  received: 10,
  inspection: 30,
  in_progress: 65,
  waiting_parts: 65,
  quality_check: 80,
  ready: 90,
  delivered: 100,
};
export function Workshop({ permissions = [] }: { permissions?: string[] }) {
  const [requests, setRequests] = useState<RequestItem[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [customersLoading, setCustomersLoading] = useState(true),
    [customersError, setCustomersError] = useState(""),
    [bicycles, setBicycles] = useState<Bicycle[]>([]),
    [bicyclesLoading, setBicyclesLoading] = useState(false),
    [showBicycleForm, setShowBicycleForm] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [orderForm, setOrderForm] = useState(ORDER_EMPTY),
    [line, setLine] = useState({ name: "", quantity: "1", price: "" }),
    [editingPart, setEditingPart] = useState<OrderPart | null>(null),
    [update, setUpdate] = useState({
      title: "",
      message: "",
      progressPercent: 0,
      photoUrl: null,
      customerVisible: true,
    }),
    [status, setStatus] = useState(""),
    [selectedStatus, setSelectedStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [detailTab, setDetailTab] = useState("summary");
  const [mobileSection, setMobileSection] = useState("requests");
  const [orderFilter, setOrderFilter] = useState("all");
  const load = () =>
    Promise.all([
      apiFetch<RequestItem[]>("/api/admin/workshop/requests"),
      apiFetch<Order[]>("/api/admin/workshop/orders"),
    ])
      .then(([a, b]) => {
        setRequests(a);
        setOrders(b);
      })
      .catch(show);
  useEffect(() => {
    load();
    apiFetch<{ items: Customer[] }>(
      "/api/admin/customers?search=&status=active&page=1&pageSize=100",
    )
      .then(({ items }) => setCustomers(items))
      .catch(() => setCustomersError("Error al cargar clientes."))
      .finally(() => setCustomersLoading(false));
  }, []);
  function show(e: unknown) {
    if (!(e instanceof ApiError)) {
      setStatus("No fue posible completar la solicitud.");
    } else if (e.status === 401) {
      setStatus("Tu sesión terminó. Inicia sesión nuevamente.");
    } else if (
      e.status === 403 &&
      e.code.toLocaleLowerCase().includes("csrf")
    ) {
      setStatus(
        "No pudimos validar la solicitud de seguridad. Recarga la página e inténtalo nuevamente.",
      );
    } else if (e.status === 403) {
      setStatus("No tienes permiso para crear órdenes de taller.");
    } else {
      setStatus(e.message);
    }
  }
  async function selectCustomer(customerId: string) {
    setOrderForm({ ...orderForm, customerId, bicycleId: "" });
    setBicycles([]);
    if (!customerId) return;
    setBicyclesLoading(true);
    try {
      setBicycles(
        await apiFetch<Bicycle[]>(
          `/api/admin/customers/${customerId}/bicycles`,
        ),
      );
    } catch (error) {
      show(error);
    } finally {
      setBicyclesLoading(false);
    }
  }
  async function convert(id: string) {
    try {
      const x = await apiFetch<{ publicToken: string }>(
        `/api/admin/workshop/requests/${id}/convert`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      setStatus(
        `Orden creada. Seguimiento: ${location.origin}/taller/${x.publicToken}`,
      );
      await load();
    } catch (e) {
      show(e);
    }
  }
  async function createOrder(e: FormEvent) {
    e.preventDefault();
    if (!orderForm.customerId || !orderForm.bicycleId) {
      setStatus("Selecciona un cliente y una bicicleta.");
      return;
    }
    try {
      const x = await apiFetch<{ publicToken: string }>(
        "/api/admin/workshop/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(orderForm),
        },
      );
      setStatus(`Orden creada: ${location.origin}/taller/${x.publicToken}`);
      setOrderForm(ORDER_EMPTY);
      setBicycles([]);
      setShowCreateOrder(false);
      await load();
    } catch (e) {
      show(e);
    }
  }
  async function open(id: string) {
    const next: any = await apiFetch(
      permissions.includes("view_workshop_financials")
        ? `/api/admin/workshop/orders/${id}/financials`
        : `/api/admin/workshop/orders/${id}`,
    );
    setDetail(next);
    setSelectedStatus(next.order.status);
    setUpdate((current) => ({
      ...current,
      progressPercent: STATUS_PROGRESS[next.order.status] ?? 0,
    }));
  }
  async function change(next: string) {
    if (!detail) return;
    try {
      await apiFetch(`/api/admin/workshop/orders/${detail.order.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: next,
          publicMessage: null,
          internalReason: null,
          customerVisible: true,
          force: false,
        }),
      });
      await open(detail.order.id);
    } catch (e) {
      show(e);
    }
  }
  async function savePart(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const unitPriceCents = parseMxnToCents(line.price);
    const quantity = Number(line.quantity);
    if (!line.name.trim()) {
      setStatus("Escribe el nombre de la pieza.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setStatus("La cantidad debe ser un número entero mayor a cero.");
      return;
    }
    if (unitPriceCents === null) {
      setStatus("Escribe el precio en pesos con máximo dos decimales.");
      return;
    }
    try {
      await apiFetch(
        `/api/admin/workshop/orders/${detail.order.id}/parts${editingPart ? `/${editingPart.id}` : ""}`,
        {
        method: editingPart ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partName: line.name.trim(),
          ...(editingPart ? {} : { brand: null, sku: null, description: null }),
          quantity,
          unitPriceCents,
          ...(editingPart ? {} : { isCustomerVisible: true, status: "planned" }),
        }),
      });
      setLine({ name: "", quantity: "1", price: "" });
      setEditingPart(null);
      setStatus(editingPart ? "Cambios de la pieza guardados." : "Pieza agregada a la orden.");
      await open(detail.order.id);
    } catch (e) {
      show(e);
    }
  }
  function editPart(part: OrderPart) {
    setEditingPart(part);
    setLine({
      name: part.partName,
      quantity: String(part.quantity),
      price:
        part.unitPriceCents === undefined
          ? ""
          : (part.unitPriceCents / 100).toFixed(2),
    });
  }
  async function updatePartStatus(part: OrderPart, next: string) {
    if (!detail) return;
    try {
      await apiFetch(
        `/api/admin/workshop/orders/${detail.order.id}/parts/${part.id}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      await open(detail.order.id);
    } catch (e) {
      show(e);
    }
  }
  async function removePart(part: OrderPart) {
    if (!detail || !confirm(`¿Quitar "${part.partName}" de esta orden?`)) return;
    try {
      await apiFetch(
        `/api/admin/workshop/orders/${detail.order.id}/parts/${part.id}`,
        { method: "DELETE" },
      );
      if (editingPart?.id === part.id) {
        setEditingPart(null);
        setLine({ name: "", quantity: "1", price: "" });
      }
      await open(detail.order.id);
    } catch (e) {
      show(e);
    }
  }
  async function publish() {
    if (!detail) return;
    try {
      await apiFetch(`/api/admin/workshop/orders/${detail.order.id}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...update,
          title: update.title.trim(),
          message: update.message.trim(),
        }),
      });
      setUpdate((current) => ({ ...current, title: "", message: "" }));
      setStatus("Actualización enviada al cliente.");
      await open(detail.order.id);
    } catch (e) {
      show(e);
    }
  }
  async function token() {
    if (!detail) return;
    const x = await apiFetch<{ publicToken: string }>(
      `/api/admin/workshop/orders/${detail.order.id}/regenerate-token`,
      { method: "POST" },
    );
    setStatus(`${location.origin}/taller/${x.publicToken}`);
  }
  async function whatsapp() {
    if (!detail) return;
    const x = await apiFetch<{ url: string }>(
      `/api/admin/workshop/orders/${detail.order.id}/whatsapp`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    window.open(x.url, "_blank", "noopener,noreferrer");
  }
  const visibleOrders = orders.filter(
    (order) => orderFilter === "all" || order.status === orderFilter,
  );
  const detailCustomer = detail
    ? customers.find((customer) => customer.id === detail.order.customerId)
    : undefined;
  return (
    <section className="admin-page workshop-page">
      <PageHeader
        eyebrow="Operación"
        title="Taller"
        description="Gestiona solicitudes y acompaña cada bicicleta hasta su entrega."
        action={
          <div className="page-header-actions">
            <Button type="button" variant="secondary" onClick={() => setShowFilters(true)}>
              Filtros
            </Button>
            <Button type="button" onClick={() => setShowCreateOrder(true)}>
              + Crear orden
            </Button>
          </div>
        }
      />
      {status && (
        <div role="alert" className="form-error">
          <p>{status}</p>
          {status.startsWith("Tu sesión") && (
            <a className="button-link" href="/admin">
              Iniciar sesión
            </a>
          )}
        </div>
      )}
      <div className="workshop-metrics responsive-grid">
        <MetricCard label="Solicitudes" value={requests.length} detail="Por revisar" />
        <MetricCard label="Órdenes" value={orders.length} detail="En el taller" />
        <MetricCard
          label="Listas"
          value={orders.filter((order) => order.status === "ready").length}
          detail="Para entregar"
        />
      </div>
      <div className="workshop-mobile-tabs">
        <Tabs
          label="Vista del taller"
          active={mobileSection}
          onChange={setMobileSection}
          items={[
            { id: "requests", label: `Solicitudes · ${requests.length}` },
            { id: "orders", label: `Órdenes · ${orders.length}` },
          ]}
        />
      </div>
      <div className="workshop-overview" data-mobile-section={mobileSection}>
        <PageSection className="workshop-panel workshop-panel--requests">
          <div className="section-heading">
            <div><p className="page-eyebrow">Entrada</p><h2>Solicitudes</h2></div>
            <span>{requests.length}</span>
          </div>
          <div className="workshop-list">
            {requests.map((request) => (
              <Card className="workshop-order-card" key={request.id}>
                <header>
                  <div>
                    <small>{request.requestNumber}</small>
                    <strong>{request.customerName}</strong>
                  </div>
                  <StatusBadge status={request.status} />
                </header>
                <p>{request.problemDescription}</p>
                <Button type="button" variant="secondary" onClick={() => void convert(request.id)}>
                  Convertir en orden
                </Button>
              </Card>
            ))}
            {!requests.length && <EmptyState title="Sin solicitudes pendientes" description="Las nuevas solicitudes aparecerán aquí." />}
          </div>
        </PageSection>
        <PageSection className="workshop-panel workshop-panel--orders">
          <div className="section-heading">
            <div><p className="page-eyebrow">En servicio</p><h2>Órdenes</h2></div>
            <span>{orders.length}</span>
          </div>
          <div className="workshop-list">
            {visibleOrders.map((order) => (
                <WorkshopOrderCard
                  key={order.id}
                  folio={order.orderNumber}
                  title={order.problemDescription}
                  status={order.status}
                  action={() => {
                    setDetailTab("summary");
                    void open(order.id);
                  }}
                />
              ))}
            {!visibleOrders.length && <EmptyState title="Sin órdenes activas" description="Crea una orden o cambia el filtro." />}
          </div>
        </PageSection>
      </div>
      {showCreateOrder && (
      <Modal open className="create-order-modal" aria-labelledby="create-order-title">
      <form onSubmit={createOrder}>
        <header className="modal-header">
          <div><p className="page-eyebrow">Nueva recepción</p><h2 id="create-order-title">Crear orden</h2></div>
          <button type="button" aria-label="Cerrar" onClick={() => setShowCreateOrder(false)}>×</button>
        </header>
        <SearchableCombobox
          label="Cliente"
          options={customers.map((customer): ComboboxOption => ({
            value: customer.id,
            label: `${customer.firstName} ${customer.lastName} · ${customer.phone}`,
            searchText: customer.email ?? "",
          }))}
          value={orderForm.customerId}
          onChange={selectCustomer}
          loading={customersLoading}
          emptyMessage={customersError || "No se encontraron clientes."}
          placeholder="Buscar por nombre, teléfono o correo"
        />
        {customersError && <p role="alert">{customersError}</p>}
        {permissions.includes("manage_customers") && (
          <a href="/admin/customers">+ Crear nuevo cliente</a>
        )}
        <SearchableCombobox
          key={orderForm.customerId || "no-customer"}
          label="Bicicleta"
          options={bicycles.map((bicycle) => ({
            value: bicycle.id,
            label:
              [
                bicycle.nickname,
                [bicycle.brand, bicycle.model].filter(Boolean).join(" "),
                bicycle.color,
                bicycle.bikeType,
                bicycle.wheelSize && `Rodada ${bicycle.wheelSize}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Bicicleta sin descripción",
          }))}
          value={orderForm.bicycleId}
          onChange={(bicycleId) => setOrderForm({ ...orderForm, bicycleId })}
          loading={bicyclesLoading}
          disabled={!orderForm.customerId || bicyclesLoading}
          placeholder={
            orderForm.customerId
              ? "Buscar bicicleta"
              : "Primero selecciona un cliente"
          }
          emptyMessage="Este cliente todavía no tiene bicicletas registradas."
        />
        {orderForm.customerId && !bicyclesLoading && bicycles.length === 0 && (
          <p>Este cliente todavía no tiene bicicletas registradas.</p>
        )}
        {orderForm.customerId && permissions.includes("manage_bicycles") && (
          <button
            type="button"
            className="secondary"
            onClick={() => setShowBicycleForm(true)}
          >
            + Registrar bicicleta
          </button>
        )}
        {(() => {
          const bicycle = bicycles.find(
            (item) => item.id === orderForm.bicycleId,
          );
          return bicycle ? (
            <article className="bicycle-summary">
              <h4>{bicycle.nickname || "Bicicleta seleccionada"}</h4>
              <dl>
                <dt>Marca y modelo</dt>
                <dd>
                  {[bicycle.brand, bicycle.model].filter(Boolean).join(" ") ||
                    "Sin especificar"}
                </dd>
                <dt>Color</dt>
                <dd>{bicycle.color || "Sin especificar"}</dd>
                <dt>Tipo</dt>
                <dd>{bicycle.bikeType || "Sin especificar"}</dd>
                <dt>Rodada</dt>
                <dd>{bicycle.wheelSize || "Sin especificar"}</dd>
              </dl>
            </article>
          ) : null;
        })()}
        <label>
          Descripción del problema
          <textarea
            required
            placeholder="Describe la falla, ruido o servicio solicitado."
            value={orderForm.problemDescription}
            onChange={(event) =>
              setOrderForm({
                ...orderForm,
                problemDescription: event.target.value,
              })
            }
          />
        </label>
        <footer className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setShowCreateOrder(false)}>Cancelar</Button>
          <Button>Crear orden</Button>
        </footer>
      </form>
      </Modal>
      )}
      {showBicycleForm && orderForm.customerId && (
        <BicycleForm
          customerId={orderForm.customerId}
          onCancel={() => setShowBicycleForm(false)}
          onCreated={(bicycle) => {
            setBicycles((current) => [...current, bicycle]);
            setOrderForm((current) => ({
              ...current,
              bicycleId: bicycle.id,
            }));
            setShowBicycleForm(false);
          }}
        />
      )}
      <Drawer
        open={showFilters}
        title="Filtrar órdenes"
        onClose={() => setShowFilters(false)}
      >
        <label>
          Estado
          <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
            <option value="all">Todos los estados</option>
            {ORDER_STATES.map((item) => (
              <option key={item} value={item}>{statusLabel(item)}</option>
            ))}
          </select>
        </label>
      </Drawer>
      {detail && (
        <Modal open className="workshop-detail" aria-labelledby="workshop-detail-title">
          <article className="workshop-detail-shell">
          <header className="modal-header workshop-detail-header">
            <div className="workshop-detail-identity">
              <p className="page-eyebrow">Orden de taller</p>
              <div>
                <h2 id="workshop-detail-title">{detail.order.orderNumber}</h2>
                <StatusBadge status={detail.order.status} />
              </div>
              <p>
                <strong>
                  {detailCustomer
                    ? `${detailCustomer.firstName} ${detailCustomer.lastName}`
                    : "Cliente registrado"}
                </strong>
                <span aria-hidden="true"> · </span>
                {detail.order.problemDescription || "Bicicleta registrada"}
              </p>
            </div>
            <div className="workshop-detail-header-actions">
              <details className="service-actions-menu"><summary aria-label="Más acciones">•••</summary><div><button type="button" onClick={token}>Generar seguimiento</button><button type="button" onClick={whatsapp}>Preparar WhatsApp</button></div></details>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setDetail(null)}>×</button>
            </div>
          </header>
          <Tabs label="Secciones de la orden" active={detailTab} onChange={setDetailTab} items={[
            { id: "summary", label: "Resumen" },
            { id: "status", label: "Estado" },
            { id: "services", label: "Servicios" },
            { id: "costs", label: "Costos" },
            { id: "customer", label: "Cliente" },
          ]} />
          <div className="workshop-detail-content">
          {detailTab === "summary" && <section className="order-summary">
            <div className="order-summary-grid">
              <Card><small>Cliente</small><strong>{detailCustomer?.firstName ?? "Cliente registrado"} {detailCustomer?.lastName ?? ""}</strong></Card>
              <Card><small>Bicicleta</small><strong>Bicicleta registrada</strong></Card>
              <Card className="order-summary-problem"><small>Problema reportado</small><strong>{detail.order.problemDescription}</strong></Card>
              <Card><small>Estado actual</small><strong>{statusLabel(detail.order.status)}</strong></Card>
              <Card><small>Total estimado</small><strong>{detail.order.totalCents === undefined ? "Restringido" : `$${(detail.order.totalCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`}</strong></Card>
              <Card className="order-summary-next"><small>Próxima acción</small><strong>{PRIMARY_TRANSITION[detail.order.status] ? TRANSITION_LABEL[PRIMARY_TRANSITION[detail.order.status]!] : "Sin acciones pendientes"}</strong></Card>
            </div>
          </section>}
          {detailTab === "status" && <div className="order-status-layout">
            <section className="order-status-panel">
              <div className="current-order-status"><div><small>Estado actual</small><strong>{statusLabel(detail.order.status)}</strong></div><StatusBadge status={detail.order.status} /></div>
              <Stepper status={detail.order.status} />
              {PRIMARY_TRANSITION[detail.order.status] && <div className="order-next-step"><small>Siguiente paso recomendado</small><strong>{TRANSITION_LABEL[PRIMARY_TRANSITION[detail.order.status]!]}</strong><p>Usa el botón principal de la parte inferior cuando la bicicleta esté lista para avanzar.</p></div>}
              <details className="order-manual-status">
                <summary>Cambiar a otro estado</summary>
                <div>
                  <label htmlFor="workshop-order-status">Nuevo estado</label>
                  <select id="workshop-order-status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>{ORDER_STATES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
                  <Button type="button" variant="secondary" disabled={selectedStatus === detail.order.status} onClick={() => change(selectedStatus)}>Guardar cambio</Button>
                </div>
              </details>
            </section>
            <Card className="detail-section workshop-update-card">
              <header><div><p className="page-eyebrow">Visible para el cliente</p><h3>Enviar actualización</h3></div><span>Opcional</span></header>
              <p>Comparte una nota breve solo cuando haya algo importante que comunicar.</p>
              <label>Título<input placeholder="Ej. Diagnóstico terminado" value={update.title} onChange={(e) => setUpdate({ ...update, title: e.target.value })} /></label>
              <label>Mensaje<textarea placeholder="Explica el avance en palabras sencillas" value={update.message} onChange={(e) => setUpdate({ ...update, message: e.target.value })} /></label>
              <label className="workshop-progress-field"><span>Progreso estimado <output>{update.progressPercent}%</output></span><input type="range" min="0" max="100" step="5" value={update.progressPercent} onChange={(e) => setUpdate({ ...update, progressPercent: Number(e.target.value) })} /></label>
              <Button type="button" disabled={!update.title.trim() || !update.message.trim()} onClick={publish}>Enviar al cliente</Button>
            </Card>
          </div>}
          {detailTab === "services" && <WorkshopServices
            orderId={detail.order.id}
            services={detail.services}
            permissions={permissions}
            onChanged={() => open(detail.order.id)}
          />}
          {detailTab === "costs" && <section className="order-costs">
            <dl>
              <div><dt>Servicios</dt><dd>{detail.order.subtotalServicesCents === undefined ? "Restringido" : `$${(detail.order.subtotalServicesCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}</dd></div>
              <div><dt>Refacciones</dt><dd>{detail.order.subtotalPartsCents === undefined ? "Restringido" : `$${(detail.order.subtotalPartsCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}</dd></div>
              {detail.order.discountCents > 0 && <div><dt>Descuento</dt><dd>−${(detail.order.discountCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</dd></div>}
              <div className="order-cost-total"><dt>Total</dt><dd>{detail.order.totalCents === undefined ? "Restringido" : `$${(detail.order.totalCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`}</dd></div>
            </dl>
          <section className="workshop-parts">
            <div className="workshop-services-heading"><div><p className="page-eyebrow">Orden</p><h4>Piezas</h4></div><span>{detail.parts.length}</span></div>
            {detail.parts.length > 0 && <div className="selected-services order-parts-list">
              {detail.parts.map((part: OrderPart) => <article key={part.id}>
                <span className={`service-state service-state--${part.status}`} aria-hidden="true" />
                <div><h5>{part.partName}</h5><p>{part.quantity} × {part.unitPriceCents === undefined ? "Restringido" : formatMxn(part.unitPriceCents)}</p><small>{statusLabel(part.status)} · {part.isCustomerVisible ? "Visible para cliente" : "Uso interno"}</small></div>
                <details className="service-actions-menu"><summary aria-label={`Acciones para ${part.partName}`}>•••</summary><div><button type="button" onClick={() => editPart(part)}>Editar</button><button type="button" onClick={() => updatePartStatus(part, "ordered")}>Marcar pedida</button><button type="button" onClick={() => updatePartStatus(part, "received")}>Marcar recibida</button><button type="button" onClick={() => updatePartStatus(part, "installed")}>Marcar instalada</button><button type="button" onClick={() => updatePartStatus(part, "cancelled")}>Cancelar</button><button type="button" onClick={() => removePart(part)}>Eliminar</button></div></details>
              </article>)}
            </div>}
            <Card className="detail-section workshop-part-form"><h3>{editingPart ? "Editar pieza" : "Agregar pieza"}</h3>
              <form onSubmit={savePart}>
                <label>Nombre<input required placeholder="Ej. Desviador trasero" value={line.name} onChange={(e) => setLine({ ...line, name: e.target.value })} /></label>
                <div className="workshop-part-fields"><label>Cantidad<input type="number" min="1" step="1" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} /></label><label>Precio unitario (MXN)<input required inputMode="decimal" placeholder="1672.00" value={line.price} onChange={(e) => setLine({ ...line, price: e.target.value })} onBlur={() => { const cents = parseMxnToCents(line.price); if (cents !== null) setLine({ ...line, price: (cents / 100).toFixed(2) }); }} /></label></div>
                <div className="workshop-part-actions"><Button>{editingPart ? "Guardar cambios" : "Agregar pieza"}</Button>{editingPart && <Button type="button" variant="ghost" onClick={() => { setEditingPart(null); setLine({ name: "", quantity: "1", price: "" }); }}>Cancelar</Button>}</div>
              </form>
            </Card>
          </section>
          </section>}
          {detailTab === "customer" && <section className="order-customer-panel">
            <Card><small>Cliente</small><h3>{detailCustomer?.firstName ?? "Cliente registrado"} {detailCustomer?.lastName ?? ""}</h3><p>{detailCustomer?.phone ?? "Teléfono no disponible en esta vista"}</p></Card>
            <div className="order-customer-actions"><Button type="button" variant="secondary" onClick={token}>Generar seguimiento</Button><Button type="button" onClick={whatsapp}>Preparar WhatsApp</Button></div>
          </section>}
          </div>
          <footer className="workshop-detail-sticky">
            {PRIMARY_TRANSITION[detail.order.status] ? <Button type="button" onClick={() => change(PRIMARY_TRANSITION[detail.order.status]!)}>{TRANSITION_LABEL[PRIMARY_TRANSITION[detail.order.status]!]}</Button> : <span>{statusLabel(detail.order.status)}</span>}
            <details className="service-actions-menu"><summary>Más</summary><div><button type="button" onClick={() => setDetailTab("status")}>Ver estado</button><button type="button" onClick={token}>Generar seguimiento</button><button type="button" onClick={whatsapp}>Preparar WhatsApp</button></div></details>
          </footer>
        </article>
        </Modal>
      )}
      {status && <Toast>{status}</Toast>}
    </section>
  );
}
