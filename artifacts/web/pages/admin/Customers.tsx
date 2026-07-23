import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import QRCode from "qrcode";
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
export function Customers() {
  const [items, setItems] = useState<Customer[]>([]),
    [form, setForm] = useState(EMPTY),
    [editing, setEditing] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [detail, setDetail] = useState<CustomerDetail | null>(null),
    [bicycles, setBicycles] = useState<
      Array<{
        id: string;
        nickname: string | null;
        brand: string | null;
        model: string | null;
        status: string;
      }>
    >([]),
    [adjustment, setAdjustment] = useState({ units: 0, reason: "" }),
    [qr, setQr] = useState({ url: "", image: "" }),
    [status, setStatus] = useState("");
  const load = () =>
    apiFetch<{ items: Customer[] }>(
      `/api/admin/customers?search=${encodeURIComponent(search)}&status=all&page=1&pageSize=50`,
    )
      .then((x) => setItems(x.items))
      .catch((e) => setStatus(e instanceof ApiError ? e.message : "Error"));
  useEffect(() => {
    load();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
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
      setStatus("Guardado");
      await load();
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Error");
    }
  }
  async function remove(id: string) {
    if (!confirm("¿Dar de baja este cliente?")) return;
    await apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
    await load();
  }
  async function token(id: string) {
    const x = await apiFetch<{ publicToken: string }>(
      `/api/admin/customers/${id}/token`,
      { method: "POST" },
    );
    await showQr(x.publicToken);
    setStatus("QR regenerado");
  }
  async function showQr(publicToken: string) {
    const url = `${location.origin}/c/${publicToken}`;
    setQr({ url, image: await QRCode.toDataURL(url, { width: 220 }) });
  }
  async function view(id: string) {
    const [customer, bikes] = await Promise.all([
      apiFetch<CustomerDetail>(`/api/admin/customers/${id}`),
      apiFetch<
        Array<{
          id: string;
          nickname: string | null;
          brand: string | null;
          model: string | null;
          status: string;
        }>
      >(`/api/admin/customers/${id}/bicycles`),
    ]);
    setDetail(customer);
    setBicycles(bikes);
  }
  async function adjust(e: FormEvent) {
    e.preventDefault();
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
      setStatus("Ajuste aplicado");
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Error");
    }
  }
  return (
    <section>
      <h2>Clientes</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          Buscar
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button>Buscar</button>
      </form>
      <div className="admin-cards">
        {items.map((c) => (
          <article key={c.id}>
            <h3>
              {c.firstName} {c.lastName}
            </h3>
            <p>
              {c.phone} · {c.email || "Sin correo"} · {c.status}
            </p>
            <div className="actions">
              <button type="button" onClick={() => view(c.id)}>
                Detalle
              </button>
              <button
                onClick={() => {
                  setEditing(c.id);
                  setForm({
                    ...EMPTY,
                    ...c,
                    email: c.email ?? "",
                    notes: c.notes ?? "",
                    birthDate: toIsoDateInput(c.birthDate),
                  });
                }}
              >
                Editar
              </button>
              <button onClick={() => token(c.id)}>Regenerar QR</button>
              <button onClick={() => remove(c.id)}>Baja</button>
            </div>
          </article>
        ))}
      </div>
      {detail && (
        <article>
          <h3>Detalle e historial</h3>
          <p>
            Disponibles: {detail.balance.availableUnits} · Pendientes:{" "}
            {detail.balance.pendingUnits} · Acumuladas:{" "}
            {detail.balance.lifetimeUnits}
          </p>
          <ul>
            {detail.rewards.map((r) => (
              <li key={r.id}>
                {r.rewardName} — {r.status} —{" "}
                {new Date(r.createdAt).toLocaleDateString("es-MX")}
              </li>
            ))}
          </ul>
          <h4>Bicicletas</h4>
          <ul>
            {bicycles.map((b) => (
              <li key={b.id}>
                {b.nickname ||
                  [b.brand, b.model].filter(Boolean).join(" ") ||
                  "Bicicleta"}{" "}
                — {b.status}
              </li>
            ))}
          </ul>
          <form onSubmit={adjust}>
            <h4>Ajuste manual</h4>
            <label>
              Unidades
              <input
                type="number"
                value={adjustment.units}
                onChange={(e) =>
                  setAdjustment({
                    ...adjustment,
                    units: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Motivo
              <input
                required
                value={adjustment.reason}
                onChange={(e) =>
                  setAdjustment({ ...adjustment, reason: e.target.value })
                }
              />
            </label>
            <button>Aplicar ajuste</button>
          </form>
        </article>
      )}
      {qr.image && (
        <section>
          <h3>QR del cliente</h3>
          <img src={qr.image} alt="Código QR público del cliente" />
          <p>
            <a href={qr.url} target="_blank" rel="noreferrer">
              Abrir tarjeta pública
            </a>
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(qr.url)}
          >
            Copiar enlace
          </button>
        </section>
      )}
      <form onSubmit={save}>
        <h3>{editing ? "Editar cliente" : "Alta de cliente"}</h3>
        {(["firstName", "lastName", "phone", "email", "notes"] as const).map(
          (k) => (
            <label key={k}>
              {k}
              <input
                type={k === "phone" ? "tel" : undefined}
                inputMode={k === "phone" ? "tel" : undefined}
                placeholder={k === "phone" ? "446 258 0377" : undefined}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ),
        )}
        <label>
          Fecha de nacimiento
          <input
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
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        <button>Guardar</button>
        <output>{status}</output>
      </form>
    </section>
  );
}
