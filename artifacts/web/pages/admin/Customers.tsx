import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { apiFetch, ApiError } from "../../lib/api-client";
import {
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  MetricCard,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Toast,
} from "../../components/ui";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  status: string;
}

interface CustomerDetail {
  customer: Customer;
  balance: {
    availableUnits: number;
    pendingUnits: number;
    lifetimeUnits: number;
    updatedAt: string;
  };
  rewards: Array<{
    id: string;
    rewardName: string;
    status: string;
    createdAt: string;
  }>;
}

interface BicycleSummary {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  status: string;
}

const EMPTY = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthDate: "",
  notes: "",
  status: "active",
};

export function toIsoDateInput(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

export function buildCustomerPayload(form: typeof EMPTY) {
  return {
    ...form,
    email: form.email.trim() || null,
    birthDate: form.birthDate || null,
    notes: form.notes.trim() || null,
  };
}

export function Customers({ permissions = [] }: { permissions?: string[] }) {
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailTab, setDetailTab] = useState("summary");
  const [bicycles, setBicycles] = useState<BicycleSummary[]>([]);
  const [adjustment, setAdjustment] = useState({ units: 0, reason: "" });
  const [qr, setQr] = useState({ url: "", image: "" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const canManage = permissions.includes("manage_customers");
  const canCreate =
    canManage || permissions.includes("create_customers");
  const canAdjust = permissions.includes("adjust_loyalty");

  const load = () => {
    setLoading(true);
    return apiFetch<{ items: Customer[] }>(
      `/api/admin/customers?search=${encodeURIComponent(search)}&status=all&page=1&pageSize=50`,
    )
      .then((result) => setItems(result.items))
      .catch((error) =>
        setStatus(error instanceof ApiError ? error.message : "Error"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch<{ publicToken?: string }>(
        editing ? `/api/admin/customers/${editing}` : "/api/admin/customers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildCustomerPayload(form)),
        },
      );
      if (result.publicToken) await showQr(result.publicToken);
      setForm(EMPTY);
      setEditing(null);
      setShowForm(false);
      setStatus("Cliente guardado");
      await load();
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Dar de baja este cliente?")) return;
    await apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
    setDetail(null);
    setStatus("Cliente dado de baja");
    await load();
  }

  async function regenerateToken(id: string) {
    const result = await apiFetch<{ publicToken: string }>(
      `/api/admin/customers/${id}/token`,
      { method: "POST" },
    );
    await showQr(result.publicToken);
    setDetailTab("qr");
    setStatus("QR regenerado");
  }

  async function showQr(publicToken: string) {
    const url = `${location.origin}/c/${publicToken}`;
    setQr({
      url,
      image: await QRCode.toDataURL(url, { width: 300, margin: 1 }),
    });
  }

  async function view(id: string) {
    const [customer, bikes] = await Promise.all([
      apiFetch<CustomerDetail>(`/api/admin/customers/${id}`),
      apiFetch<BicycleSummary[]>(`/api/admin/customers/${id}/bicycles`),
    ]);
    setDetail(customer);
    setBicycles(bikes);
    setDetailTab("summary");
  }

  async function adjust(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    try {
      await apiFetch(
        `/api/admin/customers/${detail.customer.id}/loyalty-adjustments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(adjustment),
        },
      );
      setAdjustment({ units: 0, reason: "" });
      await view(detail.customer.id);
      setDetailTab("loyalty");
      setStatus("Ajuste aplicado");
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : "Error");
    }
  }

  function startEdit(customer: Customer) {
    setEditing(customer.id);
    setForm({
      ...EMPTY,
      ...customer,
      email: customer.email ?? "",
      notes: customer.notes ?? "",
      birthDate: toIsoDateInput(customer.birthDate),
    });
    setShowForm(true);
  }

  return (
    <section className="admin-page customers-page">
      <PageHeader
        eyebrow="Directorio"
        title="Clientes"
        description="Consulta perfiles, bicicletas y recompensas desde un solo lugar."
        action={
          canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
                setShowForm(true);
              }}
            >
              + Nuevo cliente
            </Button>
          ) : undefined
        }
      />

      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          <span className="mb-sr-only">Buscar clientes</span>
          <Input
            type="search"
            placeholder="Buscar por nombre, teléfono o correo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button variant="secondary">Buscar</Button>
      </form>

      {loading ? (
        <LoadingState label="Cargando clientes…" />
      ) : items.length ? (
        <div className="customer-list">
          {items.map((customer) => (
            <Card className="customer-list-card" key={customer.id}>
              <button type="button" onClick={() => void view(customer.id)}>
                <span className="customer-avatar" aria-hidden="true">
                  {customer.firstName[0]}
                  {customer.lastName[0]}
                </span>
                <span className="customer-card-copy">
                  <strong>
                    {customer.firstName} {customer.lastName}
                  </strong>
                  <small>{customer.phone}</small>
                  <small>{customer.email || "Sin correo registrado"}</small>
                </span>
                <StatusBadge status={customer.status} />
                <i aria-hidden="true">›</i>
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No encontramos clientes"
          description="Prueba con otra búsqueda o registra un nuevo cliente."
        />
      )}

      {showForm && (
        <Modal open aria-labelledby="customer-form-title">
          <form onSubmit={save}>
            <header className="modal-header">
              <div>
                <p className="page-eyebrow">Clientes</p>
                <h2 id="customer-form-title">
                  {editing ? "Editar cliente" : "Nuevo cliente"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </header>
            <div className="form-grid">
              <label>
                Nombre
                <Input
                  required
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) =>
                    setForm({ ...form, firstName: event.target.value })
                  }
                />
              </label>
              <label>
                Apellidos
                <Input
                  required
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) =>
                    setForm({ ...form, lastName: event.target.value })
                  }
                />
              </label>
              <label>
                Teléfono
                <Input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="446 258 0377"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </label>
              <label>
                Correo
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>
              <label>
                Fecha de nacimiento
                <Input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.birthDate}
                  onChange={(event) =>
                    setForm({ ...form, birthDate: event.target.value })
                  }
                />
              </label>
              <label>
                Estado
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </Select>
              </label>
              <label className="form-span">
                Notas
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                />
              </label>
            </div>
            <footer className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button disabled={saving}>
                {saving ? "Guardando…" : "Guardar cliente"}
              </Button>
            </footer>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal open className="detail-modal" aria-labelledby="detail-title">
          <section>
            <header className="customer-detail-header">
              <span className="customer-avatar customer-avatar--large">
                {detail.customer.firstName[0]}
                {detail.customer.lastName[0]}
              </span>
              <div>
                <p className="page-eyebrow">Perfil de cliente</p>
                <h2 id="detail-title">
                  {detail.customer.firstName} {detail.customer.lastName}
                </h2>
                <p>{detail.customer.phone} · {detail.customer.email || "Sin correo"}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setDetail(null)}
              >
                ×
              </button>
            </header>
            <Tabs
              label="Secciones del cliente"
              active={detailTab}
              onChange={setDetailTab}
              items={[
                { id: "summary", label: "Resumen" },
                { id: "loyalty", label: "Fidelidad" },
                { id: "bikes", label: "Bicicletas" },
                { id: "history", label: "Historial" },
                { id: "qr", label: "QR" },
              ]}
            />
            <div className="detail-content">
              {detailTab === "summary" && (
                <>
                  <div className="summary-grid">
                    <MetricCard label="Unidades disponibles" value={detail.balance.availableUnits} />
                    <MetricCard label="Unidades pendientes" value={detail.balance.pendingUnits} />
                    <MetricCard label="Total acumulado" value={detail.balance.lifetimeUnits} />
                  </div>
                  <Card>
                    <h3>Contacto</h3>
                    <p>{detail.customer.phone}</p>
                    <p>{detail.customer.email || "Sin correo registrado"}</p>
                    {detail.customer.notes && <p>{detail.customer.notes}</p>}
                  </Card>
                </>
              )}
              {detailTab === "loyalty" && (
                <>
                  {detail.rewards.length ? detail.rewards.map((reward) => (
                    <Card key={reward.id} className="list-row">
                      <div><strong>{reward.rewardName}</strong><small>{new Date(reward.createdAt).toLocaleDateString("es-MX")}</small></div>
                      <StatusBadge status={reward.status} />
                    </Card>
                  )) : <EmptyState title="Sin recompensas" description="Las recompensas aparecerán aquí." />}
                  {canAdjust && (
                    <form className="inline-form" onSubmit={adjust}>
                      <h3>Ajuste manual</h3>
                      <label>Unidades<Input type="number" value={adjustment.units} onChange={(event) => setAdjustment({ ...adjustment, units: Number(event.target.value) })} /></label>
                      <label>Motivo<Input required value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></label>
                      <Button>Aplicar ajuste</Button>
                    </form>
                  )}
                </>
              )}
              {detailTab === "bikes" && (
                bicycles.length ? bicycles.map((bicycle) => (
                  <Card key={bicycle.id} className="list-row">
                    <div><strong>{bicycle.nickname || [bicycle.brand, bicycle.model].filter(Boolean).join(" ") || "Bicicleta"}</strong><small>{[bicycle.brand, bicycle.model].filter(Boolean).join(" ")}</small></div>
                    <StatusBadge status={bicycle.status} />
                  </Card>
                )) : <EmptyState title="Sin bicicletas" description="Este cliente todavía no tiene bicicletas registradas." />
              )}
              {detailTab === "history" && (
                <EmptyState title="Historial centralizado" description="Los movimientos de fidelidad se reflejan en la sección Fidelidad." />
              )}
              {detailTab === "qr" && (
                <div className="customer-qr">
                  {qr.image ? (
                    <>
                      <img src={qr.image} alt="Código QR público del cliente" />
                      <Button type="button" variant="secondary" onClick={() => void navigator.clipboard.writeText(qr.url)}>Copiar enlace</Button>
                    </>
                  ) : (
                    <>
                      <EmptyState title="Genera un nuevo QR" description="El enlace anterior dejará de funcionar." />
                      {canManage && <Button type="button" onClick={() => void regenerateToken(detail.customer.id)}>Generar QR</Button>}
                    </>
                  )}
                </div>
              )}
            </div>
            {canManage && (
              <footer className="modal-actions">
                <Button type="button" variant="secondary" onClick={() => startEdit(detail.customer)}>Editar</Button>
                <Button type="button" variant="danger" onClick={() => void remove(detail.customer.id)}>Dar de baja</Button>
              </footer>
            )}
          </section>
        </Modal>
      )}
      {status && <Toast>{status}</Toast>}
    </section>
  );
}
