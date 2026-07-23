import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
  Toast,
} from "../../../components/ui";
import { maskedFinancialSummary } from "../../../lib/deposits";

export interface DepositAdminOption {
  id: string;
  displayName: string;
  bankName: string;
  accountHolder: string;
  referenceText: string;
  instructions: string;
  whatsappNumber: string;
  whatsappTemplate: string;
  showAccountNumber: boolean;
  showClabe: boolean;
  showCardNumber: boolean;
  showBank: boolean;
  showHolder: boolean;
  isActive: boolean;
  sortOrder: number;
  hasAccountNumber: boolean;
  hasClabe: boolean;
  hasCardNumber: boolean;
  maskedAccountNumber?: string;
  maskedClabe?: string;
  maskedCardNumber?: string;
}

const EMPTY = {
  displayName: "",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  clabe: "",
  cardNumber: "",
  referenceText: "",
  instructions: "",
  whatsappNumber: "",
  whatsappTemplate:
    "Hola {nombre}, envío mi comprobante por {monto}. Concepto: {concepto}. Pedido: {pedido}. Banco: {banco}.",
  showAccountNumber: false,
  showClabe: false,
  showCardNumber: false,
  showBank: true,
  showHolder: true,
  isActive: false,
  sortOrder: 0,
  clearAccountNumber: false,
  clearClabe: false,
  clearCardNumber: false,
};

type DepositForm = typeof EMPTY;

export function buildDepositPayload(form: DepositForm) {
  return { ...form };
}

function protectedSummary(item: DepositAdminOption) {
  return (
    item.maskedCardNumber ||
    item.maskedClabe ||
    item.maskedAccountNumber ||
    "Sin datos protegidos"
  );
}

function DepositMethodPreview({
  form,
  current,
}: {
  form: DepositForm;
  current: DepositAdminOption | null;
}) {
  const protectedFields = [
    {
      label: "Tarjeta",
      visible: form.showCardNumber,
      value:
        (form.clearCardNumber ? "" : maskedFinancialSummary(form.cardNumber)) ||
        (form.clearCardNumber ? "" : current?.maskedCardNumber) ||
        "",
    },
    {
      label: "Cuenta",
      visible: form.showAccountNumber,
      value:
        (form.clearAccountNumber ? "" : maskedFinancialSummary(form.accountNumber)) ||
        (form.clearAccountNumber ? "" : current?.maskedAccountNumber) ||
        "",
    },
    {
      label: "CLABE",
      visible: form.showClabe,
      value:
        (form.clearClabe ? "" : maskedFinancialSummary(form.clabe)) ||
        (form.clearClabe ? "" : current?.maskedClabe) ||
        "",
    },
  ].filter((field) => field.visible && field.value);
  return (
    <aside className="deposit-admin-preview">
      <p className="page-eyebrow">Vista previa pública</p>
      <div className="deposit-preview-card">
        <header>
          <img src="/white-simple.png" alt="" />
          <span>Método de depósito</span>
        </header>
        <h3>{form.displayName || "Nombre del método"}</h3>
        {form.showHolder && form.accountHolder && (
          <p><small>Titular</small><strong>{form.accountHolder}</strong></p>
        )}
        {form.showBank && form.bankName && (
          <p><small>Institución</small><strong>{form.bankName}</strong></p>
        )}
        <div>
          {protectedFields.map((field) => (
            <span key={field.label}>
              <small>{field.label}</small>
              <strong>{field.value}</strong>
            </span>
          ))}
          {!protectedFields.length && (
            <em>Los datos visibles aparecerán aquí.</em>
          )}
        </div>
      </div>
      <small>Los valores protegidos permanecen enmascarados.</small>
    </aside>
  );
}

function ProtectedDepositField({
  label,
  name,
  value,
  masked,
  hasValue,
  clear,
  onValue,
  onClear,
}: {
  label: string;
  name: string;
  value: string;
  masked?: string;
  hasValue: boolean;
  clear: boolean;
  onValue: (value: string) => void;
  onClear: (value: boolean) => void;
}) {
  return (
    <fieldset className="protected-field">
      <legend>{label}</legend>
      <div className="protected-field-status">
        <span aria-hidden="true">⌾</span>
        <div>
          <strong>{hasValue && !clear ? masked : "Sin dato guardado"}</strong>
          <small>Dato protegido</small>
        </div>
      </div>
      <label>
        {hasValue ? `Reemplazar ${label.toLocaleLowerCase("es")}` : label}
        <input
          name={name}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          disabled={clear}
          onChange={(event) => onValue(event.target.value)}
        />
        {hasValue && (
          <small>Déjalo vacío para conservar el valor actual.</small>
        )}
      </label>
      {hasValue && (
        <Button
          type="button"
          variant={clear ? "secondary" : "danger"}
          onClick={() => {
            if (clear) {
              onClear(false);
              return;
            }
            if (window.confirm(`¿Eliminar ${label.toLocaleLowerCase("es")}?`))
              onClear(true);
          }}
        >
          {clear ? "Conservar dato" : `Eliminar ${label.toLocaleLowerCase("es")}`}
        </Button>
      )}
    </fieldset>
  );
}

export function Deposits({
  permissions = [],
}: {
  permissions?: string[];
}) {
  const [items, setItems] = useState<DepositAdminOption[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [requestId, setRequestId] = useState("");
  const canManage = permissions.includes("manage_deposit_settings");
  const current = items.find((item) => item.id === editing) ?? null;

  function showError(error: unknown) {
    const apiError = error instanceof ApiError ? error : null;
    setStatus(apiError?.message ?? "Error del servidor");
    setRequestId(apiError?.requestId ?? "");
  }

  function load() {
    setState("loading");
    apiFetch<DepositAdminOption[]>("/api/admin/settings/deposits")
      .then((result) => {
        setItems(result);
        setState("ready");
      })
      .catch((error) => {
        showError(error);
        setState("error");
      });
  }

  useEffect(load, []);

  function create() {
    setStatus("");
    setRequestId("");
    setEditing(null);
    setForm({ ...EMPTY, sortOrder: items.length });
    setShowForm(true);
  }

  function edit(item: DepositAdminOption) {
    setStatus("");
    setRequestId("");
    setEditing(item.id);
    setForm({
      ...EMPTY,
      displayName: item.displayName,
      bankName: item.bankName,
      accountHolder: item.accountHolder,
      referenceText: item.referenceText,
      instructions: item.instructions,
      whatsappNumber: item.whatsappNumber,
      whatsappTemplate: item.whatsappTemplate,
      showAccountNumber: item.showAccountNumber,
      showClabe: item.showClabe,
      showCardNumber: item.showCardNumber,
      showBank: item.showBank,
      showHolder: item.showHolder,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setShowForm(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setRequestId("");
    try {
      await apiFetch(
        editing
          ? `/api/admin/settings/deposits/${editing}`
          : "/api/admin/settings/deposits",
        {
          method: editing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildDepositPayload(form)),
        },
      );
      setStatus("Método guardado");
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: DepositAdminOption) {
    try {
      await apiFetch(`/api/admin/settings/deposits/${item.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      setStatus(item.isActive ? "Método desactivado" : "Método activado");
      await load();
    } catch (error) {
      showError(error);
    }
  }

  async function remove(item: DepositAdminOption) {
    if (!window.confirm(`¿Eliminar ${item.displayName}?`)) return;
    try {
      await apiFetch(`/api/admin/settings/deposits/${item.id}`, {
        method: "DELETE",
      });
      setStatus("Método eliminado");
      await load();
    } catch (error) {
      showError(error);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [
      reordered[target]!,
      reordered[index]!,
    ];
    try {
      await apiFetch("/api/admin/settings/deposits/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: reordered.map((item, sortOrder) => ({
            id: item.id,
            sortOrder,
          })),
        }),
      });
      setItems(reordered);
      setStatus("Orden actualizado");
    } catch (error) {
      showError(error);
    }
  }

  if (state === "loading")
    return <LoadingState label="Cargando métodos de depósito…" />;
  if (state === "error")
    return <ErrorState message={status} onRetry={load} />;

  return (
    <section className="admin-page deposits-admin-page">
      <PageHeader
        eyebrow="Configuración"
        title="Métodos de depósito"
        description="Publica instrucciones confiables sin exponer datos protegidos."
        action={
          canManage ? (
            <Button type="button" onClick={create}>+ Nuevo método</Button>
          ) : undefined
        }
      />
      {items.length ? (
        <div className="deposit-admin-list">
          {items.map((item, index) => (
            <article className="deposit-admin-card" key={item.id}>
              <header>
                <span aria-hidden="true">▤</span>
                <div>
                  <small>Orden {index + 1}</small>
                  <h2>{item.displayName}</h2>
                  <p>{item.bankName || "Sin institución"} · {protectedSummary(item)}</p>
                </div>
                <StatusBadge status={item.isActive ? "active" : "inactive"} />
              </header>
              {canManage && (
                <>
                  <label className="deposit-status-toggle">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={() => void toggle(item)}
                    />
                    <span aria-hidden="true" />
                    Publicar este método
                  </label>
                  <footer>
                    <Button type="button" variant="secondary" onClick={() => edit(item)}>
                      Editar
                    </Button>
                    <div>
                      <button type="button" onClick={() => void move(index, -1)} disabled={index === 0} aria-label={`Subir ${item.displayName}`}>↑</button>
                      <button type="button" onClick={() => void move(index, 1)} disabled={index === items.length - 1} aria-label={`Bajar ${item.displayName}`}>↓</button>
                      <button type="button" onClick={() => void remove(item)} aria-label={`Eliminar ${item.displayName}`}>×</button>
                    </div>
                  </footer>
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aún no hay métodos"
          description="Crea el primer método para mostrar instrucciones de depósito."
        />
      )}

      {showForm && (
        <Modal open className="deposit-form-modal" aria-labelledby="deposit-form-title">
          <form onSubmit={save}>
            <header className="modal-header">
              <div>
                <p className="page-eyebrow">Datos protegidos</p>
                <h2 id="deposit-form-title">
                  {editing ? "Editar método" : "Nuevo método"}
                </h2>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowForm(false)}>×</button>
            </header>
            <div className="deposit-form-layout">
              <div className="deposit-form-fields">
                <section className="deposit-form-section">
                  <h3>Información pública</h3>
                  <div className="form-grid">
                    <label>Nombre<input required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
                    <label>Institución o banco<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label>
                    <label className="form-span">Titular<input value={form.accountHolder} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} /></label>
                    <label className="form-span">Concepto o referencia<input value={form.referenceText} onChange={(event) => setForm({ ...form, referenceText: event.target.value })} /></label>
                    <label className="form-span">Instrucciones<textarea rows={4} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
                  </div>
                </section>
                <section className="deposit-form-section">
                  <h3>Datos protegidos</h3>
                  <p>Los valores guardados nunca se muestran completos en administración.</p>
                  <ProtectedDepositField
                    label="Número de cuenta"
                    name="accountNumber"
                    value={form.accountNumber}
                    masked={current?.maskedAccountNumber}
                    hasValue={Boolean(current?.hasAccountNumber)}
                    clear={form.clearAccountNumber}
                    onValue={(value) => setForm({ ...form, accountNumber: value, clearAccountNumber: false })}
                    onClear={(value) => setForm({ ...form, accountNumber: "", clearAccountNumber: value })}
                  />
                  <ProtectedDepositField
                    label="Número de tarjeta"
                    name="cardNumber"
                    value={form.cardNumber}
                    masked={current?.maskedCardNumber}
                    hasValue={Boolean(current?.hasCardNumber)}
                    clear={form.clearCardNumber}
                    onValue={(value) => setForm({ ...form, cardNumber: value, clearCardNumber: false })}
                    onClear={(value) => setForm({ ...form, cardNumber: "", clearCardNumber: value })}
                  />
                  <ProtectedDepositField
                    label="CLABE"
                    name="clabe"
                    value={form.clabe}
                    masked={current?.maskedClabe}
                    hasValue={Boolean(current?.hasClabe)}
                    clear={form.clearClabe}
                    onValue={(value) => setForm({ ...form, clabe: value, clearClabe: false })}
                    onClear={(value) => setForm({ ...form, clabe: "", clearClabe: value })}
                  />
                </section>
                <section className="deposit-form-section">
                  <h3>Visibilidad y contacto</h3>
                  <div className="deposit-checkboxes">
                    {([
                      ["showAccountNumber", "Mostrar número de cuenta"],
                      ["showCardNumber", "Mostrar número de tarjeta"],
                      ["showClabe", "Mostrar CLABE"],
                      ["showBank", "Mostrar institución"],
                      ["showHolder", "Mostrar titular"],
                      ["isActive", "Método activo"],
                    ] as const).map(([key, label]) => (
                      <label key={key}>
                        <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form-grid">
                    <label>WhatsApp<input type="tel" placeholder="+524421234567" value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} /></label>
                    <label>Orden<input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
                    <label className="form-span">Plantilla para comprobante<textarea rows={3} value={form.whatsappTemplate} onChange={(event) => setForm({ ...form, whatsappTemplate: event.target.value })} /></label>
                  </div>
                </section>
              </div>
              <DepositMethodPreview form={form} current={current} />
            </div>
            {status && (
              <div className="form-error" role="alert">
                {status}
                {requestId && <small>Solicitud: {requestId}</small>}
              </div>
            )}
            <footer className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button disabled={saving}>{saving ? "Guardando…" : "Guardar método"}</Button>
            </footer>
          </form>
        </Modal>
      )}
      {status && !showForm && <Toast>{status}</Toast>}
    </section>
  );
}
