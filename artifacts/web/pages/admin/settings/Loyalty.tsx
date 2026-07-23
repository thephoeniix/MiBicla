import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
  Toast,
} from "../../../components/ui";
import { LoyaltyCard } from "../../../components/domain";

interface Rule {
  minimumAmount: number;
  units: number;
}

const EMPTY = {
  enabled: false,
  currency: "MXN" as const,
  purchaseRules: [] as Rule[],
  rewardUnits: 0,
  rewardDiscountPercent: 0,
  rewardName: "",
  rewardDescription: "",
  allowManualAdjustments: false,
  allowNegativeBalance: false,
};

export function Loyalty() {
  const [data, setData] = useState(EMPTY);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [simulatedPurchase, setSimulatedPurchase] = useState(500);

  function load() {
    setLoadState("loading");
    apiFetch<typeof EMPTY>("/api/admin/settings/loyalty")
      .then((result) => {
        setData({ ...EMPTY, ...result });
        setLoadState("ready");
      })
      .catch((error) => {
        setStatus(error instanceof ApiError ? error.message : "Error");
        setLoadState("error");
      });
  }

  useEffect(load, []);

  function rule(index: number, patch: Partial<Rule>) {
    setData({
      ...data,
      purchaseRules: data.purchaseRules.map((item, current) =>
        current === index ? { ...item, ...patch } : item,
      ),
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings/loyalty", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus("Configuración guardada");
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading")
    return <LoadingState label="Cargando programa de fidelidad…" />;
  if (loadState === "error")
    return <ErrorState message={status} onRetry={load} />;

  const previewUnits = Math.min(Math.max(Math.ceil(data.rewardUnits * 0.4), 0), data.rewardUnits);
  const simulatedUnits = [...data.purchaseRules]
    .sort((a, b) => a.minimumAmount - b.minimumAmount)
    .reduce(
      (units, item) =>
        simulatedPurchase * 100 >= item.minimumAmount ? item.units : units,
      0,
    );

  return (
    <section className="admin-page loyalty-settings">
      <PageHeader
        eyebrow="Configuración"
        title="Programa de fidelidad"
        description="Define cómo tus clientes acumulan puntos y obtienen recompensas."
      />
      <form onSubmit={save}>
        <div className="settings-layout">
          <div className="settings-main">
            <Card className="settings-card settings-card--status">
              <div>
                <p className="page-eyebrow">Estado del programa</p>
                <h2>{data.enabled ? "Programa activo" : "Programa pausado"}</h2>
                <p>
                  {data.enabled
                    ? "Los clientes pueden seguir acumulando unidades."
                    : "Las compras no generan unidades mientras esté pausado."}
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={data.enabled}
                  onChange={(event) =>
                    setData({ ...data, enabled: event.target.checked })
                  }
                />
                <span aria-hidden="true" />
                <b>{data.enabled ? "Activo" : "Pausado"}</b>
              </label>
            </Card>

            <Card className="settings-card">
              <header className="card-heading">
                <div>
                  <p className="page-eyebrow">Reglas de compra</p>
                  <h2>¿Cómo se obtienen unidades?</h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setData({
                      ...data,
                      purchaseRules: [
                        ...data.purchaseRules,
                        { minimumAmount: 0, units: 1 },
                      ],
                    })
                  }
                >
                  + Agregar regla
                </Button>
              </header>
              <div className="rule-list">
                {data.purchaseRules.map((item, index) => (
                  <fieldset
                    className="rule-card"
                    key={`${item.minimumAmount}-${index}`}
                  >
                    <legend>Regla {index + 1}</legend>
                    <label>
                      Compra mínima
                      <span className="input-prefix">
                        <i>$</i>
                        <Input
                          type="number"
                          min="0"
                          value={item.minimumAmount / 100}
                          onChange={(event) =>
                            rule(index, {
                              minimumAmount: Math.round(
                                Number(event.target.value) * 100,
                              ),
                            })
                          }
                        />
                      </span>
                    </label>
                    <label>
                      Unidades obtenidas
                      <Input
                        type="number"
                        min="0"
                        value={item.units}
                        onChange={(event) =>
                          rule(index, { units: Number(event.target.value) })
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setData({
                          ...data,
                          purchaseRules: data.purchaseRules.filter(
                            (_, current) => current !== index,
                          ),
                        })
                      }
                    >
                      Eliminar
                    </Button>
                  </fieldset>
                ))}
                {!data.purchaseRules.length && (
                  <p className="inline-empty">
                    Agrega una regla para comenzar a otorgar unidades.
                  </p>
                )}
              </div>
            </Card>

            <Card className="settings-card">
              <div className="card-heading">
                <div>
                  <p className="page-eyebrow">Configuración de recompensa</p>
                  <h2>La meta de tus clientes</h2>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Unidades necesarias para obtener una recompensa
                  <Input
                    type="number"
                    min="1"
                    value={data.rewardUnits}
                    onChange={(event) =>
                      setData({
                        ...data,
                        rewardUnits: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Descuento de la recompensa
                  <span className="input-suffix">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={data.rewardDiscountPercent}
                      onChange={(event) =>
                        setData({
                          ...data,
                          rewardDiscountPercent: Number(event.target.value),
                        })
                      }
                    />
                    <i>%</i>
                  </span>
                </label>
                <label className="form-span">
                  Nombre de la recompensa
                  <Input
                    value={data.rewardName}
                    onChange={(event) =>
                      setData({ ...data, rewardName: event.target.value })
                    }
                  />
                </label>
                <label className="form-span">
                  Descripción
                  <Textarea
                    rows={3}
                    value={data.rewardDescription}
                    onChange={(event) =>
                      setData({
                        ...data,
                        rewardDescription: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="preference-list">
                <label>
                  <input
                    type="checkbox"
                    checked={data.allowManualAdjustments}
                    onChange={(event) =>
                      setData({
                        ...data,
                        allowManualAdjustments: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Permitir ajustes manuales</strong>
                    <small>El equipo podrá sumar o restar unidades.</small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={data.allowNegativeBalance}
                    onChange={(event) =>
                      setData({
                        ...data,
                        allowNegativeBalance: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Permitir saldo negativo</strong>
                    <small>Úsalo sólo para correcciones excepcionales.</small>
                  </span>
                </label>
              </div>
            </Card>

            <Card className="settings-card simulator-card">
              <p className="page-eyebrow">Simulador</p>
              <h2>Prueba una compra</h2>
              <label>
                Importe de compra
                <span className="input-prefix">
                  <i>$</i>
                  <Input
                    type="number"
                    min="0"
                    value={simulatedPurchase}
                    onChange={(event) =>
                      setSimulatedPurchase(Number(event.target.value))
                    }
                  />
                </span>
              </label>
              <output>
                Esta compra otorgaría <strong>{simulatedUnits}</strong>{" "}
                {simulatedUnits === 1 ? "unidad" : "unidades"}.
              </output>
            </Card>
          </div>

          <aside className="loyalty-preview-column">
            <Card className="loyalty-preview">
              <p className="page-eyebrow">Vista previa</p>
              <LoyaltyCard
                current={previewUnits}
                goal={data.rewardUnits}
                rewardName={data.rewardName}
              />
              <p>La vista se actualiza con la configuración del formulario.</p>
            </Card>
          </aside>
        </div>
        <div className="sticky-save">
          <span>{status || "Los cambios no se guardan automáticamente."}</span>
          <Button disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
      {status === "Configuración guardada" && <Toast>{status}</Toast>}
    </section>
  );
}
