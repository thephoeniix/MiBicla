import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
interface Rule {
  minimumAmount: number;
  units: number;
}
const EMPTY = {
  enabled: false,
  currency: "MXN" as const,
  purchaseRules: [] as Rule[],
  rewardUnits: 10,
  rewardDiscountPercent: 10,
  rewardName: "Recompensa",
  rewardDescription: "",
  allowManualAdjustments: false,
  allowNegativeBalance: false,
};
export function Loyalty() {
  const [data, setData] = useState(EMPTY),
    [status, setStatus] = useState("");
  useEffect(() => {
    apiFetch<typeof EMPTY>("/api/admin/settings/loyalty")
      .then((x) => setData({ ...EMPTY, ...x }))
      .catch((e) => setStatus(e instanceof ApiError ? e.message : "Error"));
  }, []);
  function rule(index: number, patch: Partial<Rule>) {
    setData({
      ...data,
      purchaseRules: data.purchaseRules.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/settings/loyalty", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus("Guardado");
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Error");
    }
  }
  return (
    <form onSubmit={save}>
      <h2>Programa de Fidelidad</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={data.enabled}
          onChange={(e) => setData({ ...data, enabled: e.target.checked })}
        />
        Programa activo
      </label>
      <h3>Reglas de compra</h3>
      {data.purchaseRules.map((r, i) => (
        <fieldset key={`${r.minimumAmount}-${i}`}>
          <label>
            Compra mínima (MXN)
            <input
              type="number"
              min="0"
              value={r.minimumAmount / 100}
              onChange={(e) =>
                rule(i, {
                  minimumAmount: Math.round(Number(e.target.value) * 100),
                })
              }
            />
          </label>
          <label>
            Unidades
            <input
              type="number"
              min="0"
              value={r.units}
              onChange={(e) => rule(i, { units: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setData({
                ...data,
                purchaseRules: data.purchaseRules.filter((_, x) => x !== i),
              })
            }
          >
            Eliminar regla
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          setData({
            ...data,
            purchaseRules: [
              ...data.purchaseRules,
              { minimumAmount: 0, units: 0 },
            ],
          })
        }
      >
        Agregar regla
      </button>
      {(["rewardUnits", "rewardDiscountPercent"] as const).map((k) => (
        <label key={k}>
          {k}
          <input
            type="number"
            min="0"
            max={k === "rewardDiscountPercent" ? 100 : undefined}
            value={data[k]}
            onChange={(e) => setData({ ...data, [k]: Number(e.target.value) })}
          />
        </label>
      ))}
      <label>
        Nombre
        <input
          value={data.rewardName}
          onChange={(e) => setData({ ...data, rewardName: e.target.value })}
        />
      </label>
      <label>
        Descripción
        <textarea
          value={data.rewardDescription}
          onChange={(e) =>
            setData({ ...data, rewardDescription: e.target.value })
          }
        />
      </label>
      {(["allowManualAdjustments", "allowNegativeBalance"] as const).map(
        (k) => (
          <label className="check" key={k}>
            <input
              type="checkbox"
              checked={data[k]}
              onChange={(e) => setData({ ...data, [k]: e.target.checked })}
            />
            {k}
          </label>
        ),
      )}
      <button>Guardar</button>
      <output>{status}</output>
    </form>
  );
}
