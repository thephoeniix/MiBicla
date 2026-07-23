import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { BicycleForm, type Bicycle } from "../../components/BicycleForm";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "../../components/SearchableCombobox";
import { WorkshopServices } from "../../components/WorkshopServices";
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
  return (
    <section>
      <h2>Taller</h2>
      {status && (
        <div role="alert" className="alert">
          <p>{status}</p>
          {status.startsWith("Tu sesión") && (
            <a className="button-link" href="/admin">
              Iniciar sesión
            </a>
          )}
        </div>
      )}
      <h3>Solicitudes</h3>
      {requests.map((x) => (
        <article key={x.id}>
          <strong>
            {x.requestNumber} — {x.customerName}
          </strong>
          <p>
            {x.problemDescription} · {x.status}
          </p>
          <button type="button" onClick={() => convert(x.id)}>
            Convertir en orden
          </button>
        </article>
      ))}
      <h3>Órdenes</h3>
      {orders.map((x) => (
        <button type="button" key={x.id} onClick={() => open(x.id)}>
          {x.orderNumber} — {x.status}
        </button>
      ))}
      <form onSubmit={createOrder}>
        <h3>Crear orden</h3>
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
        <button>Crear</button>
      </form>
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
      {detail && (
        <article>
          <h3>{detail.order.orderNumber}</h3>
          <p>
            {detail.order.problemDescription} · {detail.order.status}
          </p>
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
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <WorkshopServices
            orderId={detail.order.id}
            services={detail.services}
            permissions={permissions}
            onChanged={() => open(detail.order.id)}
          />
          <h4>Agregar pieza</h4>
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
          <h4>Publicar avance</h4>
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
      )}
    </section>
  );
}
