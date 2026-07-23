import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
interface Option {
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
export function Deposits() {
  const [items, setItems] = useState<Option[]>([]),
    [form, setForm] = useState(EMPTY),
    [editing, setEditing] = useState<string | null>(null),
    [status, setStatus] = useState("");
  const showError = (e: unknown) =>
    setStatus(e instanceof ApiError ? e.message : "Error del servidor");
  const load = () =>
    apiFetch<Option[]>("/api/admin/settings/deposits")
      .then(setItems)
      .catch(showError);
  useEffect(() => {
    load();
  }, []);
  function edit(item: Option) {
    setEditing(item.id);
    setForm({
      ...EMPTY,
      ...item,
      accountNumber: "",
      clabe: "",
      cardNumber: "",
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(
        editing
          ? `/api/admin/settings/deposits/${editing}`
          : "/api/admin/settings/deposits",
        {
          method: editing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setStatus("Guardado exitoso");
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (error) {
      showError(error);
    }
  }
  async function toggle(item: Option) {
    try {
      await apiFetch(`/api/admin/settings/deposits/${item.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await load();
    } catch (e) {
      showError(e);
    }
  }
  async function remove(item: Option) {
    if (!window.confirm(`¿Eliminar ${item.displayName}?`)) return;
    try {
      await apiFetch(`/api/admin/settings/deposits/${item.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      showError(e);
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
      await load();
    } catch (e) {
      showError(e);
    }
  }
  return (
    <section>
      <h2>Opciones de depósito</h2>
      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setForm(EMPTY);
        }}
      >
        Nueva opción de depósito
      </button>
      <div className="admin-cards">
        {items.map((item, index) => (
          <article key={item.id}>
            <h3>{item.displayName}</h3>
            <p>
              {item.bankName || "Sin banco"} ·{" "}
              {item.isActive ? "Activo" : "Inactivo"} · Orden {item.sortOrder}
            </p>
            <p>
              Campos:{" "}
              {[
                item.hasAccountNumber && "cuenta",
                item.hasClabe && "CLABE",
                item.hasCardNumber && "tarjeta",
              ]
                .filter(Boolean)
                .join(", ") || "ninguno"}
            </p>
            <div className="actions">
              <button type="button" onClick={() => edit(item)}>
                Editar
              </button>
              <button type="button" onClick={() => toggle(item)}>
                {item.isActive ? "Desactivar" : "Activar"}
              </button>
              <button type="button" onClick={() => move(index, -1)}>
                Subir
              </button>
              <button type="button" onClick={() => move(index, 1)}>
                Bajar
              </button>
              <button type="button" onClick={() => remove(item)}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={save}>
        <h3>{editing ? "Editar opción" : "Nueva opción"}</h3>
        {(
          [
            "displayName",
            "bankName",
            "accountHolder",
            "accountNumber",
            "clabe",
            "cardNumber",
            "referenceText",
            "whatsappNumber",
            "whatsappTemplate",
          ] as const
        ).map((k) => (
          <label key={k}>
            {k}
            <input
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Instrucciones
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </label>
        <label>
          Orden
          <input
            type="number"
            min="0"
            value={form.sortOrder}
            onChange={(e) =>
              setForm({ ...form, sortOrder: Number(e.target.value) })
            }
          />
        </label>
        {(
          [
            "showAccountNumber",
            "showClabe",
            "showCardNumber",
            "showBank",
            "showHolder",
            "isActive",
            "clearAccountNumber",
            "clearClabe",
            "clearCardNumber",
          ] as const
        ).map((k) => (
          <label className="check" key={k}>
            <input
              type="checkbox"
              checked={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
            />
            {k}
          </label>
        ))}
        <button>Guardar</button>
        <output>{status}</output>
      </form>
    </section>
  );
}
