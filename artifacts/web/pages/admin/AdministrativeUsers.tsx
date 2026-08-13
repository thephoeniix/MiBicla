import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import {
  Button,
  EmptyState,
  ErrorState,
  FormDialog,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  Toast,
} from "../../components/ui";

type ManagedRole = "admin" | "employee";
interface AdministrativeUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | ManagedRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: ManagedRole;
}
const EMPTY: CreateForm = { name: "", email: "", password: "", role: "employee" };
const ROLE_LABELS = { owner: "Owner", admin: "Administrador", employee: "Empleado" };

export function buildAdministrativeUserPayload(form: CreateForm) {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    role: form.role,
  };
}

function PasswordRequirements() {
  return (
    <small className="password-requirements">
      Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
    </small>
  );
}

export function AdministrativeUsers({ currentUserId }: { currentUserId: string }) {
  const [items, setItems] = useState<AdministrativeUser[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdministrativeUser | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    setState("loading");
    try {
      setItems(await apiFetch<AdministrativeUser[]>("/api/admin/administrators"));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar las cuentas.");
      setState("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : "No fue posible completar la acción.");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      await apiFetch("/api/admin/administrators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildAdministrativeUserPayload(form)),
      });
      setCreateOpen(false);
      setForm(EMPTY);
      setMessage("Cuenta administrativa creada");
      await load();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else setFormError("No fue posible crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(item: AdministrativeUser, role: ManagedRole) {
    if (item.role === role) return;
    if (!window.confirm(`¿Cambiar a ${item.name} al rol ${ROLE_LABELS[role]}? Sus sesiones activas se cerrarán.`)) return;
    try {
      await apiFetch(`/api/admin/administrators/${item.id}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setMessage("Rol actualizado y sesiones cerradas");
      await load();
    } catch (error) {
      showError(error);
    }
  }

  async function toggleStatus(item: AdministrativeUser) {
    const verb = item.isActive ? "desactivar" : "activar";
    if (!window.confirm(`¿Quieres ${verb} la cuenta de ${item.name}?${item.isActive ? " Sus sesiones activas se cerrarán." : ""}`)) return;
    try {
      await apiFetch(`/api/admin/administrators/${item.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      setMessage(item.isActive ? "Cuenta desactivada" : "Cuenta activada");
      await load();
    } catch (error) {
      showError(error);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setFormError("");
    try {
      await apiFetch(`/api/admin/administrators/${resetTarget.id}/password/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      setResetTarget(null);
      setNewPassword("");
      setMessage("Contraseña actualizada y sesiones cerradas");
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No fue posible cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <LoadingState label="Cargando usuarios administrativos…" />;
  if (state === "error") return <ErrorState message={message} onRetry={load} />;

  return (
    <section className="admin-page administrative-users-page">
      <PageHeader
        eyebrow="Seguridad y equipo"
        title="Usuarios administrativos"
        description="Asigna el acceso necesario a cada integrante del equipo."
        action={<Button type="button" onClick={() => { setFormError(""); setFieldErrors({}); setCreateOpen(true); }}>+ Nueva cuenta</Button>}
      />
      <div className="administrative-users-note">
        <strong>Roles</strong>
        <span><b>Administrador:</b> configura y opera todas las áreas del negocio.</span>
        <span><b>Empleado:</b> atiende clientes y taller sin acceso a configuración sensible.</span>
      </div>
      {items.length ? (
        <div className="administrative-users-list">
          {items.map((item) => {
            const protectedAccount = item.role === "owner" || item.id === currentUserId;
            return (
              <article className="administrative-user-card" key={item.id}>
                <header>
                  <span className="administrative-user-avatar" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span>
                  <div><h2>{item.name}</h2><p>{item.email}</p></div>
                  <StatusBadge status={item.isActive ? "active" : "inactive"} />
                </header>
                <dl>
                  <div><dt>Rol</dt><dd>{ROLE_LABELS[item.role]}</dd></div>
                  <div><dt>Último acceso</dt><dd>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin acceso todavía"}</dd></div>
                </dl>
                {protectedAccount ? (
                  <p className="administrative-user-protected">Cuenta protegida. Se administra fuera de este módulo.</p>
                ) : (
                  <footer>
                    <label>
                      Rol
                      <Select value={item.role} onChange={(event) => void changeRole(item, event.target.value as ManagedRole)}>
                        <option value="admin">Administrador</option>
                        <option value="employee">Empleado</option>
                      </Select>
                    </label>
                    <Button type="button" variant="secondary" onClick={() => { setFormError(""); setNewPassword(""); setResetTarget(item); }}>Cambiar contraseña</Button>
                    <Button type="button" variant={item.isActive ? "danger" : "secondary"} onClick={() => void toggleStatus(item)}>{item.isActive ? "Desactivar" : "Activar"}</Button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      ) : <EmptyState title="Aún no hay cuentas" description="Crea una cuenta para cada integrante del equipo." />}

      {createOpen && (
        <FormDialog open aria-labelledby="create-administrator-title">
          <form onSubmit={create}>
            <header className="form-dialog-header"><div><p className="page-eyebrow">Acceso del equipo</p><h2 id="create-administrator-title">Nueva cuenta</h2></div><button type="button" data-dialog-close aria-label="Cerrar" onClick={() => setCreateOpen(false)}>×</button></header>
            <div className="form-dialog-body form-grid">
              <label>Nombre<Input name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={150} required aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}</label>
              <label>Correo<Input name="email" type="email" autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={254} required aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}</label>
              <label>Rol<Select name="role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ManagedRole })}><option value="employee">Empleado</option><option value="admin">Administrador</option></Select></label>
              <label>Contraseña temporal<Input name="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={12} maxLength={128} required aria-invalid={Boolean(fieldErrors.password)} /><PasswordRequirements />{fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}</label>
              {formError && <p className="form-error form-span" role="alert">{formError}</p>}
            </div>
            <footer className="modal-actions form-dialog-actions"><Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={saving}>{saving ? "Creando…" : "Crear cuenta"}</Button></footer>
          </form>
        </FormDialog>
      )}

      {resetTarget && (
        <FormDialog open aria-labelledby="reset-administrator-title">
          <form onSubmit={resetPassword}>
            <header className="form-dialog-header"><div><p className="page-eyebrow">Seguridad</p><h2 id="reset-administrator-title">Cambiar contraseña</h2><p>{resetTarget.name}</p></div><button type="button" data-dialog-close aria-label="Cerrar" onClick={() => setResetTarget(null)}>×</button></header>
            <div className="form-dialog-body"><p>Al guardar, todas las sesiones de esta cuenta se cerrarán.</p><label>Nueva contraseña<Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} required /><PasswordRequirements /></label>{formError && <p className="form-error" role="alert">{formError}</p>}</div>
            <footer className="modal-actions form-dialog-actions"><Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>Cancelar</Button><Button disabled={saving}>{saving ? "Guardando…" : "Guardar contraseña"}</Button></footer>
          </form>
        </FormDialog>
      )}
      {message && <Toast>{message}</Toast>}
    </section>
  );
}
