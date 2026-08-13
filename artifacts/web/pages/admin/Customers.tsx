import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { apiFetch, ApiError } from "../../lib/api-client";
import type { CustomerAuthLink } from "../../lib/customer-auth";
import { BicycleForm, type Bicycle } from "../../components/BicycleForm";
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
  loyaltyProgram: {
    enabled: boolean;
    allowManualAdjustments: boolean;
  } | null;
  credentialStatus: string | null;
  activationExpiresAt: string | null;
  hasActiveActivation: boolean;
}

type BicycleSummary = Bicycle;
export interface RegistrationRequest {
  reviewId: string;
  reference: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export const REGISTRATION_STATUS_TABS: Array<{ id: string; label: string }> = [
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
  { id: "rejected", label: "Rechazadas" },
  { id: "expired", label: "Expiradas" },
];

export function countPendingRegistrations(requests: RegistrationRequest[]) {
  return requests.filter((request) => request.status === "pending").length;
}

export function filterRegistrationsByStatus(
  requests: RegistrationRequest[],
  status: string,
) {
  return requests.filter((request) => request.status === status);
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
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    birthDate: form.birthDate || null,
    notes: form.notes.trim() || null,
    status: form.status,
  };
}

type CustomerField = keyof typeof EMPTY;
const CUSTOMER_FIELD_MESSAGES: Partial<Record<CustomerField, string>> = {
  firstName: "Escribe un nombre válido.",
  lastName: "Escribe los apellidos.",
  phone: "Ingresa un teléfono mexicano válido de 10 dígitos.",
  email: "Ingresa un correo válido.",
  birthDate: "Ingresa una fecha de nacimiento válida.",
};

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
  const [adjusting, setAdjusting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CustomerField, string>>>({});
  const fieldRefs = useRef<Partial<Record<CustomerField, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});
  const [editingBicycle, setEditingBicycle] = useState<Bicycle | null>(null);
  const [authLink, setAuthLink] = useState<{
    purpose: "activation" | "recovery";
    customerId: string;
    value: CustomerAuthLink;
  } | null>(null);
  const [authLinkLoading, setAuthLinkLoading] = useState<
    "activation" | "recovery" | null
  >(null);
  const [authLinkNotice, setAuthLinkNotice] = useState("");
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [registrationDetail, setRegistrationDetail] = useState<RegistrationRequest | null>(null);
  const [registrationTab, setRegistrationTab] = useState("pending");
  const [deciding, setDeciding] = useState(false);
  const registrationSectionRef = useRef<HTMLElement | null>(null);

  const canManage = permissions.includes("manage_customers");
  const canManageBicycles = permissions.includes("manage_bicycles");
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

  const loadRegistrationRequests = () =>
    apiFetch<RegistrationRequest[]>("/api/admin/customer-registration-requests")
      .then(setRegistrationRequests)
      .catch((error) => {
        setStatus(error instanceof ApiError ? error.message : "No fue posible actualizar las solicitudes.");
      });

  useEffect(() => {
    void load();
    const customerId = new URLSearchParams(location.search).get("customer");
    if (customerId) {
      void view(customerId).catch((error) =>
        setStatus(
          error instanceof ApiError
            ? error.message
            : "No fue posible abrir el cliente escaneado.",
        ),
      );
    }
    if (canManage) {
      void loadRegistrationRequests();
      const reviewId = location.pathname.match(/^\/admin\/customers\/requests\/([a-f0-9]{64})$/)?.[1];
      if (reviewId) void openRegistration(reviewId).catch((error) => {
        setStatus(error instanceof ApiError ? error.message : "No fue posible abrir la solicitud.");
      });
    }
    const refresh = () => {
      if (document.visibilityState === "visible" && canManage)
        void loadRegistrationRequests();
    };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, []);

  async function openRegistration(reviewId: string) {
    const request = await apiFetch<RegistrationRequest>(
      `/api/admin/customer-registration-requests/${reviewId}`,
    );
    setRegistrationDetail(request);
  }

  async function decideRegistration(action: "approve" | "reject") {
    if (!registrationDetail || deciding) return;
    if (!confirm(action === "approve"
      ? "Confirmo que verifiqué manualmente este número y deseo preparar el enlace de activación."
      : "¿Confirmas que deseas rechazar esta solicitud?")) return;
    const whatsappWindow = action === "approve" ? window.open("about:blank", "_blank") : null;
    if (whatsappWindow) whatsappWindow.opener = null;
    setDeciding(true);
    try {
      const result = await apiFetch<
        { customerId: string; expiresAt: string; link: string; whatsappUrl: string } | undefined
      >(
        `/api/admin/customer-registration-requests/${registrationDetail.reviewId}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: action === "reject" ? JSON.stringify({}) : undefined,
        },
      );
      setRegistrationDetail(null);
      await loadRegistrationRequests();
      if (action === "approve") {
        await load();
        if (result) {
          setAuthLinkNotice("");
          setAuthLink({ purpose: "activation", customerId: result.customerId, value: result });
          if (whatsappWindow) whatsappWindow.location.replace(result.whatsappUrl);
        }
      }
      setStatus(action === "approve" ? "Cuenta aprobada" : "Solicitud rechazada");
    } catch (error) {
      whatsappWindow?.close();
      setStatus(
        error instanceof ApiError
          ? error.message
          : "No fue posible completar la acción. Inténtalo nuevamente.",
      );
    } finally {
      setDeciding(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await apiFetch<Customer & { publicToken?: string }>(
        editing ? `/api/admin/customers/${editing}` : "/api/admin/customers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildCustomerPayload(form)),
        },
      );
      if (result.publicToken) await showQr(result.publicToken);
      const editedId = editing;
      setForm(EMPTY);
      setEditing(null);
      setShowForm(false);
      setStatus(editing ? "Cambios del cliente guardados." : "Cliente guardado.");
      await load();
      if (editedId && detail?.customer.id === editedId) await view(editedId);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        const next = Object.fromEntries(
          Object.keys(error.fieldErrors)
            .filter((field): field is CustomerField => field in EMPTY)
            .map((field) => [field, CUSTOMER_FIELD_MESSAGES[field] ?? "Revisa este campo."]),
        );
        setFieldErrors(next);
        const first = Object.keys(next)[0] as CustomerField | undefined;
        if (first) requestAnimationFrame(() => fieldRefs.current[first]?.focus());
        setStatus("Revisa los campos indicados.");
      } else {
        setStatus(error instanceof ApiError ? "No fue posible guardar el cliente. Inténtalo nuevamente." : "No fue posible guardar el cliente.");
      }
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

  async function view(id: string, tab = "summary") {
    const [customer, bikes] = await Promise.all([
      apiFetch<CustomerDetail>(`/api/admin/customers/${id}`, { cache: "no-store" }),
      apiFetch<BicycleSummary[]>(`/api/admin/customers/${id}/bicycles`, { cache: "no-store" }),
    ]);
    setDetail(customer);
    setBicycles(bikes);
    setDetailTab(tab);
  }

  async function adjust(event: FormEvent) {
    event.preventDefault();
    if (!detail || adjusting || adjustment.units === 0) return;
    const customerId = detail.customer.id;
    setAdjusting(true);
    try {
      const result = await apiFetch<{ availableUnits: number; rewardsCreated: number }>(
        `/api/admin/customers/${customerId}/loyalty-adjustments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(adjustment),
        },
      );
      setDetail((current) => current?.customer.id === customerId
        ? {
            ...current,
            balance: {
              ...current.balance,
              availableUnits: result.availableUnits,
              lifetimeUnits: current.balance.lifetimeUnits + Math.max(0, adjustment.units),
              updatedAt: new Date().toISOString(),
            },
          }
        : current);
      setAdjustment({ units: 0, reason: "" });
      await view(customerId, "loyalty");
      setStatus(result.rewardsCreated
        ? `Ajuste aplicado. ${result.rewardsCreated} recompensa generada.`
        : "Ajuste aplicado. Saldo actualizado.");
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : "No fue posible aplicar el ajuste.");
    } finally {
      setAdjusting(false);
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
    setFieldErrors({});
  }

  function clearFieldError(field: CustomerField) {
    if (!fieldErrors[field]) return;
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function prepareAuthLink(customerId: string, purpose: "activation" | "recovery") {
    setAuthLinkLoading(purpose);
    try {
      const value = await apiFetch<CustomerAuthLink>(
        `/api/admin/customers/${customerId}/auth/${purpose}`,
        { method: "POST" },
      );
      setAuthLinkNotice("");
      setAuthLink({ purpose, customerId, value });
      if (detail?.customer.id === customerId) await view(customerId);
    } catch (error) {
      setStatus(
        error instanceof ApiError && error.status === 409
          ? "La cuenta requiere revisión o no está disponible."
          : error instanceof ApiError
            ? error.message
            : "No fue posible preparar el enlace.",
      );
    } finally {
      setAuthLinkLoading(null);
    }
  }

  return (
    <section className="admin-page customers-page">
      <PageHeader
        eyebrow="Directorio"
        title="Clientes"
        description="Consulta perfiles, bicicletas y recompensas desde un solo lugar."
        action={
          canManage || canCreate ? (
            <div className="page-header-actions">
              {canManage && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void loadRegistrationRequests();
                    const section = registrationSectionRef.current;
                    if (!section) return;
                    section.scrollIntoView({ behavior: "smooth", block: "start" });
                    section.focus({ preventScroll: true });
                  }}
                >
                  Revisar solicitudes
                  {countPendingRegistrations(registrationRequests) > 0 && (
                    <span className="registration-pending-badge" aria-hidden="true">
                      {countPendingRegistrations(registrationRequests)}
                    </span>
                  )}
                </Button>
              )}
              {canCreate && (
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
              )}
            </div>
          ) : undefined
        }
      />

      {canManage && <section
        ref={registrationSectionRef}
        tabIndex={-1}
        aria-label="Solicitudes de acceso"
        className={`registration-review-list${countPendingRegistrations(registrationRequests) > 0 ? " registration-review-list--attention" : ""}`}
      >
        <header className="registration-review-header">
          <h2>Solicitudes de acceso</h2>
          {countPendingRegistrations(registrationRequests) > 0 && (
            <span className="registration-pending-badge" role="status">
              {countPendingRegistrations(registrationRequests)} pendiente
              {countPendingRegistrations(registrationRequests) === 1 ? "" : "s"}
            </span>
          )}
        </header>
        <Tabs
          label="Estado de solicitudes"
          active={registrationTab}
          onChange={setRegistrationTab}
          items={REGISTRATION_STATUS_TABS}
        />
        {filterRegistrationsByStatus(registrationRequests, registrationTab).length ? (
          filterRegistrationsByStatus(registrationRequests, registrationTab).map((request) => (
            <Card key={request.reviewId} className="list-row registration-row">
              <div>
                <strong>{request.firstName} {request.lastName}</strong>
                <small>{request.reference} · {new Date(request.createdAt).toLocaleDateString("es-MX")}</small>
              </div>
              <div className="registration-row-actions">
                <StatusBadge status={request.status} />
                <Button type="button" variant="secondary" onClick={() => void openRegistration(request.reviewId)}>
                  Revisar
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            title={`Sin solicitudes ${(REGISTRATION_STATUS_TABS.find((tab) => tab.id === registrationTab)?.label ?? "").toLowerCase()}`}
            description="Cuando haya solicitudes en este estado, aparecerán aquí."
          />
        )}
      </section>}

      <h2 className="customers-list-heading">Clientes</h2>
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
                  ref={(node) => { fieldRefs.current.firstName = node; }}
                  required
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={fieldErrors.firstName ? "customer-first-name-error" : undefined}
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) =>
                    (clearFieldError("firstName"), setForm({ ...form, firstName: event.target.value }))
                  }
                />
                {fieldErrors.firstName && <small className="field-error" id="customer-first-name-error">{fieldErrors.firstName}</small>}
              </label>
              <label>
                Apellidos
                <Input
                  ref={(node) => { fieldRefs.current.lastName = node; }}
                  required
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  aria-describedby={fieldErrors.lastName ? "customer-last-name-error" : undefined}
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) =>
                    (clearFieldError("lastName"), setForm({ ...form, lastName: event.target.value }))
                  }
                />
                {fieldErrors.lastName && <small className="field-error" id="customer-last-name-error">{fieldErrors.lastName}</small>}
              </label>
              <label>
                Teléfono
                <Input
                  ref={(node) => { fieldRefs.current.phone = node; }}
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="442 000 0000"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "customer-phone-error" : undefined}
                  value={form.phone}
                  onChange={(event) =>
                    (clearFieldError("phone"), setForm({ ...form, phone: event.target.value }))
                  }
                />
                {fieldErrors.phone && <small className="field-error" id="customer-phone-error">{fieldErrors.phone}</small>}
              </label>
              <label>
                Correo
                <Input
                  ref={(node) => { fieldRefs.current.email = node; }}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "customer-email-error" : undefined}
                  value={form.email}
                  onChange={(event) =>
                    (clearFieldError("email"), setForm({ ...form, email: event.target.value }))
                  }
                />
                {fieldErrors.email && <small className="field-error" id="customer-email-error">{fieldErrors.email}</small>}
              </label>
              <label>
                Fecha de nacimiento
                <Input
                  ref={(node) => { fieldRefs.current.birthDate = node; }}
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  aria-invalid={Boolean(fieldErrors.birthDate)}
                  aria-describedby={fieldErrors.birthDate ? "customer-birth-date-error" : undefined}
                  value={form.birthDate}
                  onChange={(event) =>
                    (clearFieldError("birthDate"), setForm({ ...form, birthDate: event.target.value }))
                  }
                />
                {fieldErrors.birthDate && <small className="field-error" id="customer-birth-date-error">{fieldErrors.birthDate}</small>}
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

      {registrationDetail && (
        <Modal open aria-labelledby="registration-review-title">
          <section>
            <header className="modal-header">
              <div><p className="page-eyebrow">Solicitud {registrationDetail.reference}</p><h2 id="registration-review-title">{registrationDetail.firstName} {registrationDetail.lastName}</h2></div>
              <button type="button" aria-label="Cerrar" onClick={() => setRegistrationDetail(null)}>×</button>
            </header>
            <p className="form-notice">Antes de aprobar, confirma que el número registrado coincide con el remitente del mensaje de WhatsApp.</p>
            <dl>
              <div>
                <dt>Teléfono</dt>
                <dd>
                  {registrationDetail.phone || "Sin teléfono"}
                  {registrationDetail.phone && (
                    <>
                      {" "}
                      <a
                        className="registration-contact-link"
                        href={`tel:${registrationDetail.phone}`}
                        aria-label={`Llamar a ${registrationDetail.firstName} ${registrationDetail.lastName}`}
                      >
                        Llamar
                      </a>
                    </>
                  )}
                </dd>
              </div>
              <div><dt>Correo</dt><dd>{registrationDetail.email || "Sin correo"}</dd></div>
              <div><dt>Fecha de solicitud</dt><dd>{new Date(registrationDetail.createdAt).toLocaleDateString("es-MX")}</dd></div>
              <div><dt>Estado</dt><dd><StatusBadge status={registrationDetail.status} /></dd></div>
            </dl>
            {registrationDetail.status === "pending" && <footer className="modal-actions">
              <Button type="button" variant="secondary" disabled={deciding} onClick={() => void decideRegistration("reject")}>
                {deciding ? "Procesando…" : "Rechazar solicitud"}
              </Button>
              <Button type="button" disabled={deciding} onClick={() => void decideRegistration("approve")}>
                {deciding ? "Procesando…" : "Verificar y generar activación"}
              </Button>
            </footer>}
          </section>
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
                  {canManage && <Card className="customer-auth-actions">
                    <h3>Acceso del cliente</h3>
                    <p>Prepara un enlace temporal para compartirlo manualmente.</p>
                    {detail.hasActiveActivation && detail.activationExpiresAt && (
                      <p className="form-notice">
                        Activación vigente hasta{" "}
                        {new Date(detail.activationExpiresAt).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}.
                      </p>
                    )}
                    <div>
                      {detail.credentialStatus !== "active" && (
                        <Button
                          type="button"
                          disabled={Boolean(authLinkLoading)}
                          onClick={() => void prepareAuthLink(detail.customer.id, "activation")}
                        >
                          {authLinkLoading === "activation"
                            ? "Generando…"
                            : detail.credentialStatus === "pending"
                              ? "Generar nuevo enlace"
                              : "Generar activación"}
                        </Button>
                      )}
                      {detail.credentialStatus === "active" && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={Boolean(authLinkLoading)}
                          onClick={() => void prepareAuthLink(detail.customer.id, "recovery")}
                        >
                          {authLinkLoading === "recovery" ? "Generando…" : "Generar recuperación"}
                        </Button>
                      )}
                    </div>
                  </Card>}
                </>
              )}
              {detailTab === "loyalty" && (
                <>
                  <div className="summary-grid">
                    <MetricCard label="Unidades disponibles" value={detail.balance.availableUnits} />
                    <MetricCard label="Total acumulado" value={detail.balance.lifetimeUnits} />
                  </div>
                  {detail.rewards.length ? detail.rewards.map((reward) => (
                    <Card key={reward.id} className="list-row">
                      <div><strong>{reward.rewardName}</strong><small>{new Date(reward.createdAt).toLocaleDateString("es-MX")}</small></div>
                      <StatusBadge status={reward.status} />
                    </Card>
                  )) : <EmptyState title="Sin recompensas" description="Las recompensas aparecerán aquí." />}
                  {canAdjust && detail.loyaltyProgram?.allowManualAdjustments && (
                    <form className="inline-form" onSubmit={adjust}>
                      <h3>Ajuste manual</h3>
                      <label>Unidades<Input required type="number" step="1" value={adjustment.units} onChange={(event) => setAdjustment({ ...adjustment, units: Number(event.target.value) })} /></label>
                      <label>Motivo<Input required value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></label>
                      <Button disabled={adjusting || adjustment.units === 0}>{adjusting ? "Aplicando…" : "Aplicar ajuste"}</Button>
                    </form>
                  )}
                  {canAdjust && !detail.loyaltyProgram?.allowManualAdjustments && (
                    <p className="form-notice">Los ajustes manuales están desactivados en la configuración de fidelidad.</p>
                  )}
                </>
              )}
              {detailTab === "bikes" && (
                bicycles.length ? bicycles.map((bicycle) => (
                  <Card key={bicycle.id} className="customer-bicycle-card">
                    <header><strong>{bicycle.nickname || [bicycle.brand, bicycle.model].filter(Boolean).join(" ") || "Bicicleta"}</strong><StatusBadge status={bicycle.status} /></header>
                    <dl>
                      <div><dt>Marca</dt><dd>{bicycle.brand || "Sin especificar"}</dd></div>
                      <div><dt>Modelo</dt><dd>{bicycle.model || "Sin especificar"}</dd></div>
                      <div><dt>Tipo</dt><dd>{bicycle.bikeType || "Sin especificar"}</dd></div>
                    </dl>
                    {canManageBicycles && <Button type="button" variant="secondary" onClick={() => setEditingBicycle(bicycle)}>Editar bicicleta</Button>}
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
      {editingBicycle && detail && (
        <BicycleForm
          customerId={detail.customer.id}
          bicycle={editingBicycle}
          onCreated={() => undefined}
          onCancel={() => setEditingBicycle(null)}
          onSaved={(saved) => {
            setBicycles((current) => current.map((item) => item.id === saved.id ? saved : item));
            setEditingBicycle(null);
            setStatus("Información de la bicicleta actualizada.");
          }}
        />
      )}
      {authLink && (
        <Modal open aria-labelledby="customer-auth-link-title">
          <section>
            <header className="modal-header">
              <div>
                <p className="page-eyebrow">Enlace temporal</p>
                <h2 id="customer-auth-link-title">
                  {authLink.purpose === "activation" ? "Activación generada" : "Recuperación generada"}
                </h2>
              </div>
              <button type="button" aria-label="Cerrar enlace" onClick={() => {
                setAuthLink(null);
                setAuthLinkNotice("");
              }}>×</button>
            </header>
            <p>Este enlace expira el {new Date(authLink.value.expiresAt).toLocaleString("es-MX")}.</p>
            <div className="auth-link-value" aria-label="Enlace generado">{authLink.value.link}</div>
            <p className="form-notice">Confirma directamente en WhatsApp que el mensaje fue enviado.</p>
            <footer className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => {
                void navigator.clipboard.writeText(authLink.value.link)
                  .then(() => setAuthLinkNotice("Enlace copiado."))
                  .catch(() => setAuthLinkNotice("No fue posible copiar el enlace."));
              }}>Copiar enlace</Button>
              <a className="ui-button" href={authLink.value.whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(authLinkLoading)}
                onClick={() => void prepareAuthLink(authLink.customerId, authLink.purpose)}
              >
                {authLinkLoading ? "Generando…" : "Generar nuevo enlace"}
              </Button>
            </footer>
            <p className="mb-sr-only" role="status" aria-live="polite">{authLinkNotice}</p>
          </section>
        </Modal>
      )}
      {status && <Toast>{status}</Toast>}
    </section>
  );
}
