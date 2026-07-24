import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { BicycleForm, type Bicycle } from "../../components/BicycleForm";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "../../components/SearchableCombobox";
import { WorkshopServices } from "../../components/WorkshopServices";
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
    [line, setLine] = useState({ name: "", quantity: 1, unitPriceCents: 0 }),
    [update, setUpdate] = useState({
      title: "",
      message: "",
      progressPercent: 0,
      photoUrl: null,
      customerVisible: true,
    }),
    [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
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
    setDetail(
      await apiFetch(
        permissions.includes("view_workshop_financials")
          ? `/api/admin/workshop/orders/${id}/financials`
          : `/api/admin/workshop/orders/${id}`,
      ),
    );
  }
  async function change(next: string) {
    if (!detail) return;
    try {
      await apiFetch(`/api/admin/workshop/orders/${detail.order.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: next,
          publicMessage: `Estado actualizado: ${next}`,
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
  async function add(kind: "services" | "parts") {
    if (!detail) return;
    const body =
      kind === "services"
        ? {
            serviceName: line.name,
            description: null,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            isCustomerVisible: true,
            status: "pending",
          }
        : {
            partName: line.name,
            brand: null,
            sku: null,
            description: null,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            isCustomerVisible: true,
            status: "planned",
          };
    try {
      await apiFetch(`/api/admin/workshop/orders/${detail.order.id}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await open(detail.order.id);
    } catch (e) {
      show(e);
    }
  }
  async function publish() {
    if (!detail) return;
    await apiFetch(`/api/admin/workshop/orders/${detail.order.id}/updates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    });
    await open(detail.order.id);
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
                  action={() => void open(order.id)}
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
            {["received", "diagnosis", "approved", "in_progress", "ready", "delivered"].map((item) => (
              <option key={item} value={item}>{statusLabel(item)}</option>
            ))}
          </select>
        </label>
      </Drawer>
      {detail && (
        <Modal open className="workshop-detail" aria-labelledby="workshop-detail-title">
          <article>
          <header className="modal-header">
            <div>
              <p className="page-eyebrow">Orden de taller</p>
              <h2 id="workshop-detail-title">{detail.order.orderNumber}</h2>
              <p>{detail.order.problemDescription}</p>
            </div>
            <button type="button" aria-label="Cerrar detalle" onClick={() => setDetail(null)}>×</button>
          </header>
          <StatusBadge status={detail.order.status} />
          <Stepper status={detail.order.status} />
          <label>
            Nuevo estado
            <select
              value={detail.order.status}
              onChange={(e) => change(e.target.value)}
            >
              {[
                "received",
                "inspection",
                "diagnosis",
                "waiting_approval",
                "approved",
                "in_progress",
                "waiting_parts",
                "quality_check",
                "ready",
                "delivered",
                "cancelled",
              ].map((x) => (
                <option key={x} value={x}>{statusLabel(x)}</option>
              ))}
            </select>
          </label>
          <WorkshopServices
            orderId={detail.order.id}
            services={detail.services}
            permissions={permissions}
            onChanged={() => open(detail.order.id)}
          />
          <Card className="detail-section"><h3>Agregar pieza</h3>
          <label>
            Nombre
            <input
              value={line.name}
              onChange={(e) => setLine({ ...line, name: e.target.value })}
            />
          </label>
          <label>
            Cantidad
            <input
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) =>
                setLine({ ...line, quantity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Precio centavos
            <input
              type="number"
              min="0"
              value={line.unitPriceCents}
              onChange={(e) =>
                setLine({ ...line, unitPriceCents: Number(e.target.value) })
              }
            />
          </label>
          <button type="button" onClick={() => add("parts")}>
            Agregar pieza
          </button>
          </Card>
          <Card className="detail-section"><h3>Publicar avance</h3>
          <label>
            Título
            <input
              value={update.title}
              onChange={(e) => setUpdate({ ...update, title: e.target.value })}
            />
          </label>
          <label>
            Mensaje
            <textarea
              value={update.message}
              onChange={(e) =>
                setUpdate({ ...update, message: e.target.value })
              }
            />
          </label>
          <label>
            Progreso
            <input
              type="number"
              min="0"
              max="100"
              value={update.progressPercent}
              onChange={(e) =>
                setUpdate({
                  ...update,
                  progressPercent: Number(e.target.value),
                })
              }
            />
          </label>
          <button type="button" onClick={publish}>
            Publicar
          </button>
          </Card>
          <div className="actions">
            <button type="button" onClick={token}>
              Generar seguimiento
            </button>
            <button type="button" onClick={whatsapp}>
              Abrir WhatsApp
            </button>
            <button type="button" onClick={() => change("delivered")}>
              Marcar entregada
            </button>
          </div>
        </article>
        </Modal>
      )}
      {status && <Toast>{status}</Toast>}
    </section>
  );
}
