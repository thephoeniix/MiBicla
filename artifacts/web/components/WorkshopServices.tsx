import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api-client";
import { SearchableCombobox } from "./SearchableCombobox";
import { Dialog } from "./ui";

interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  suggestedPriceCents: number;
  estimatedDurationMinutes: number | null;
  isCustomerVisible: boolean;
  isActive: boolean;
  sortOrder: number;
}
interface OrderService {
  id: string;
  catalogServiceId?: string | null;
  serviceName: string;
  description: string | null;
  quantity: number;
  unitPriceCents?: number;
  status: string;
  isCustomerVisible: boolean;
  performedBy: string | null;
}
interface Technician {
  id: string;
  name: string;
}
const NEW_SERVICE = {
  name: "",
  description: "",
  price: "",
  duration: "",
  isCustomerVisible: true,
  isActive: true,
};

export function parseMxnToCents(value: string): number | null {
  const normalized = value.trim().replace(/[$,\s]|MXN/gi, "");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [pesos, decimals = ""] = normalized.split(".");
  return Number(pesos) * 100 + Number(decimals.padEnd(2, "0"));
}
export const formatMxn = (cents: number) =>
  `${new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100)} MXN`;

export function WorkshopServices({
  orderId,
  services,
  permissions,
  onChanged,
}: {
  orderId: string;
  services: OrderService[];
  permissions: string[];
  onChanged: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<CatalogService | null>(
    null,
  );
  const [form, setForm] = useState(NEW_SERVICE);
  const [editingLine, setEditingLine] = useState<OrderService | null>(null);
  const [lineForm, setLineForm] = useState({
    quantity: "1",
    price: "",
    description: "",
    status: "pending",
    isCustomerVisible: true,
    performedBy: "",
  });
  const [error, setError] = useState("");
  const canManage = permissions.includes("manage_workshop_services");
  const canManagePrices = permissions.includes("manage_workshop_financials");
  const loadCatalog = () =>
    apiFetch<CatalogService[]>("/api/admin/workshop/service-catalog").then(
      setCatalog,
    );
  useEffect(() => {
    loadCatalog().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Error"),
    );
    apiFetch<Technician[]>("/api/admin/workshop/technicians")
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }, []);

  async function select(service: CatalogService) {
    if (services.some((line) => line.catalogServiceId === service.id)) return;
    await apiFetch(`/api/admin/workshop/orders/${orderId}/services`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        catalogServiceId: service.id,
        serviceName: service.name,
        description: service.description,
        quantity: 1,
        unitPriceCents: service.suggestedPriceCents,
        isCustomerVisible: service.isCustomerVisible,
        status: "pending",
        performedBy: null,
      }),
    });
    await onChanged();
  }
  async function saveCatalog(event: FormEvent) {
    event.preventDefault();
    const cents = parseMxnToCents(form.price);
    if (cents === null) {
      setError("Escribe un precio válido con máximo dos decimales.");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      suggestedPriceCents: cents,
      estimatedDurationMinutes: form.duration ? Number(form.duration) : null,
      isCustomerVisible: form.isCustomerVisible,
      isActive: form.isActive,
      sortOrder: editingCatalog?.sortOrder ?? catalog.length * 10 + 10,
    };
    const saved = await apiFetch<CatalogService>(
      editingCatalog
        ? `/api/admin/workshop/service-catalog/${editingCatalog.id}`
        : "/api/admin/workshop/service-catalog",
      {
        method: editingCatalog ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    await loadCatalog();
    setShowNew(false);
    setEditingCatalog(null);
    setForm(NEW_SERVICE);
    if (!editingCatalog) await select(saved);
  }
  function editCatalog(service: CatalogService) {
    setEditingCatalog(service);
    setForm({
      name: service.name,
      description: service.description ?? "",
      price: (service.suggestedPriceCents / 100).toFixed(2),
      duration: service.estimatedDurationMinutes?.toString() ?? "",
      isCustomerVisible: service.isCustomerVisible,
      isActive: service.isActive,
    });
    setShowNew(true);
  }
  async function removeCatalog(service: CatalogService) {
    if (!confirm(`¿Eliminar "${service.name}" del catálogo?`)) return;
    await apiFetch(`/api/admin/workshop/service-catalog/${service.id}`, {
      method: "DELETE",
    });
    await loadCatalog();
  }
  async function move(service: CatalogService, direction: -1 | 1) {
    await apiFetch(`/api/admin/workshop/service-catalog/${service.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sortOrder: service.sortOrder + direction * 15 }),
    });
    await loadCatalog();
  }
  function editLine(service: OrderService) {
    setEditingLine(service);
    setLineForm({
      quantity: service.quantity.toString(),
      price:
        service.unitPriceCents === undefined
          ? ""
          : (service.unitPriceCents / 100).toFixed(2),
      description: service.description ?? "",
      status: service.status,
      isCustomerVisible: service.isCustomerVisible,
      performedBy: service.performedBy ?? "",
    });
  }
  async function saveLine(event: FormEvent) {
    event.preventDefault();
    if (!editingLine) return;
    const cents = canManagePrices ? parseMxnToCents(lineForm.price) : undefined;
    if (canManagePrices && cents === null) {
      setError("Escribe un precio válido con máximo dos decimales.");
      return;
    }
    await apiFetch(
      `/api/admin/workshop/orders/${orderId}/services/${editingLine.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: Number(lineForm.quantity),
          ...(cents === undefined ? {} : { unitPriceCents: cents }),
          description: lineForm.description || null,
          status: lineForm.status,
          isCustomerVisible: lineForm.isCustomerVisible,
          performedBy: lineForm.performedBy || null,
        }),
      },
    );
    setEditingLine(null);
    await onChanged();
  }
  async function updateStatus(service: OrderService, status: string) {
    await apiFetch(
      `/api/admin/workshop/orders/${orderId}/services/${service.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    await onChanged();
  }
  async function removeLine(service: OrderService) {
    if (!confirm(`¿Quitar "${service.serviceName}" de esta orden?`)) return;
    await apiFetch(
      `/api/admin/workshop/orders/${orderId}/services/${service.id}`,
      { method: "DELETE" },
    );
    await onChanged();
  }

  return (
    <section className="workshop-services">
      <header className="workshop-services-heading">
        <div><p className="page-eyebrow">Orden</p><h4>Servicios</h4></div>
        {canManage && <button type="button" className="secondary" onClick={() => setShowCatalog((current) => !current)}>{showCatalog ? "Cerrar catálogo" : "Editar catálogo"}</button>}
      </header>
      {error && <p role="alert">{error}</p>}
      {showCatalog && <div className="service-catalog">
        {catalog.map((service) => (
          <article key={service.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={services.some(
                  (line) => line.catalogServiceId === service.id,
                )}
                disabled={!canManage}
                onChange={() => select(service).catch(console.error)}
              />
              <span>
                <strong>{service.name}</strong>
                <small>
                  {formatMxn(service.suggestedPriceCents)}
                  {service.estimatedDurationMinutes
                    ? ` · ${service.estimatedDurationMinutes} min`
                    : ""}
                </small>
              </span>
            </label>
            {canManage && (
              <details className="service-actions-menu">
                <summary aria-label={`Acciones para ${service.name}`}>•••</summary>
                <div>
                  <button type="button" onClick={() => editCatalog(service)}>Editar</button>
                  <button type="button" onClick={() => move(service, -1)}>Mover arriba</button>
                  <button type="button" onClick={() => move(service, 1)}>Mover abajo</button>
                  <button type="button" onClick={() => removeCatalog(service)}>Eliminar</button>
                </div>
              </details>
            )}
          </article>
        ))}
      </div>}
      {canManage && showCatalog && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setEditingCatalog(null);
            setForm(NEW_SERVICE);
            setShowNew(true);
          }}
        >
          + Agregar servicio
        </button>
      )}
      <div className="selected-services">
        {services.map((service) => (
          <article key={service.id}>
            <span className={`service-state service-state--${service.status}`} aria-hidden="true" />
            <div><h5>{service.serviceName}</h5>
            <p>{service.quantity} ×{" "}
              {service.unitPriceCents === undefined
                ? "Restringido"
                : formatMxn(service.unitPriceCents)}
            </p>
            <small>{service.status} · {service.isCustomerVisible ? "Visible para cliente" : "Uso interno"}</small></div>
            <details className="service-actions-menu">
              <summary aria-label={`Acciones para ${service.serviceName}`}>•••</summary>
              <div>
                <button type="button" onClick={() => editLine(service)}>Editar</button>
                <button type="button" onClick={() => updateStatus(service, "in_progress")}>Marcar en proceso</button>
                <button type="button" onClick={() => updateStatus(service, "completed")}>Marcar completado</button>
                <button type="button" onClick={() => updateStatus(service, "cancelled")}>Cancelar</button>
                <button type="button" onClick={() => removeLine(service)}>Eliminar</button>
              </div>
            </details>
          </article>
        ))}
      </div>
      {showNew && (
        <Dialog open aria-labelledby="catalog-service-title">
          <form onSubmit={saveCatalog}>
            <h3 id="catalog-service-title">
              {editingCatalog ? "Editar servicio" : "Agregar servicio"}
            </h3>
            <label>
              Nombre del servicio
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Descripción
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Precio sugerido (MXN)
              <input
                inputMode="decimal"
                placeholder="250.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label>
              Duración estimada (minutos)
              <input
                type="number"
                min="1"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.isCustomerVisible}
                onChange={(e) =>
                  setForm({ ...form, isCustomerVisible: e.target.checked })
                }
              />
              Visible para el cliente
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Estado activo
            </label>
            <div className="actions">
              <button>Guardar servicio</button>
              <button
                type="button"
                className="secondary"
                aria-label="Cerrar formulario de servicio"
                onClick={() => setShowNew(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {editingLine && (
        <Dialog open aria-labelledby="order-service-title">
          <form onSubmit={saveLine}>
            <h3 id="order-service-title">Editar {editingLine.serviceName}</h3>
            <label>
              Cantidad
              <input
                type="number"
                min="1"
                value={lineForm.quantity}
                onChange={(e) =>
                  setLineForm({ ...lineForm, quantity: e.target.value })
                }
              />
            </label>
            {canManagePrices && (
              <label>
                Precio unitario (MXN)
                <input
                  inputMode="decimal"
                  value={lineForm.price}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, price: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              Descripción
              <textarea
                value={lineForm.description}
                onChange={(e) =>
                  setLineForm({ ...lineForm, description: e.target.value })
                }
              />
            </label>
            <label>
              Estado
              <select
                value={lineForm.status}
                onChange={(e) =>
                  setLineForm({ ...lineForm, status: e.target.value })
                }
              >
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobado</option>
                <option value="in_progress">En proceso</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <SearchableCombobox
              label="Técnico responsable"
              options={technicians.map((person) => ({
                value: person.id,
                label: person.name,
              }))}
              value={lineForm.performedBy}
              onChange={(performedBy) =>
                setLineForm({ ...lineForm, performedBy })
              }
            />
            <label className="check">
              <input
                type="checkbox"
                checked={lineForm.isCustomerVisible}
                onChange={(e) =>
                  setLineForm({
                    ...lineForm,
                    isCustomerVisible: e.target.checked,
                  })
                }
              />
              Visible para el cliente
            </label>
            <div className="actions">
              <button>Guardar cambios</button>
              <button
                type="button"
                className="secondary"
                aria-label="Cerrar edición de servicio"
                onClick={() => setEditingLine(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
