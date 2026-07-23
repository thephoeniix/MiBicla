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
import {
  loyaltySettingsChanged,
  moveLoyaltyStage,
  replaceLoyaltyRule,
} from "../../../lib/loyalty-settings";

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

export function Loyalty({ permissions = [] }: { permissions?: string[] }) {
  const [data, setData] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [stage, setStage] = useState(1);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [requestId, setRequestId] = useState("");
  const [simulatedPurchase, setSimulatedPurchase] = useState(500);

  function load() {
    setLoadState("loading");
    apiFetch<typeof EMPTY>("/api/admin/settings/loyalty")
      .then((result) => {
        const loaded = { ...EMPTY, ...result };
        setData(loaded);
        setOriginal(loaded);
        setLoadState("ready");
      })
      .catch((error) => {
        setStatus(error instanceof ApiError ? error.message : "Error");
        setRequestId(error instanceof ApiError ? error.requestId ?? "" : "");
        setLoadState("error");
      });
  }

  useEffect(load, []);

  function rule(index: number, patch: Partial<Rule>) {
    setData({
      ...data,
      purchaseRules: replaceLoyaltyRule(data.purchaseRules, index, patch),
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setRequestId("");
    try {
      await apiFetch("/api/admin/settings/loyalty", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      setOriginal(data);
      setStatus("Configuración guardada");
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : "Error");
      setRequestId(error instanceof ApiError ? error.requestId ?? "" : "");
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
    <section
      className="admin-page loyalty-settings"
      data-mobile-stage={stage}
    >
      <div className="loyalty-desktop-heading">
        <PageHeader
        eyebrow="Configuración"
        title="Programa de fidelidad"
        description="Define cómo tus clientes acumulan puntos y obtienen recompensas."
        />
      </div>
      <header className="loyalty-mobile-heading">
        <p className="page-eyebrow">Configuración</p>
        <h1>{["Fidelidad", "Reglas de compra", "Configurar recompensa", "Revisar cambios"][stage - 1]}</h1>
        <p>Paso {stage} de 4</p>
      </header>
      <nav className="loyalty-stage-nav" aria-label="Etapas de configuración">
        {["Fidelidad", "Reglas", "Recompensa", "Revisar"].map((label, index) => (
          <button
            type="button"
            key={label}
            aria-current={stage === index + 1 ? "step" : undefined}
            onClick={() => setStage(index + 1)}
          >
            <i>{index + 1}</i><span>{label}</span>
          </button>
        ))}
      </nav>
      <form onSubmit={save}>
        <div className="settings-layout">
          <div className="settings-main">
            <Card className="settings-card settings-card--status loyalty-stage loyalty-stage--1">
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
            <div className="loyalty-summary-cards loyalty-stage loyalty-stage--1">
              <Card><small>Meta</small><strong>{data.rewardUnits}</strong><span>unidades</span></Card>
              <Card><small>Recompensa</small><strong>{data.rewardDiscountPercent}%</strong><span>{data.rewardName || "Sin nombre"}</span></Card>
            </div>
            <Card className="loyalty-mobile-preview loyalty-stage loyalty-stage--1">
              <p className="page-eyebrow">Vista previa</p>
              <LoyaltyCard current={previewUnits} goal={data.rewardUnits} rewardName={data.rewardName} />
            </Card>
            {permissions.includes("adjust_loyalty") && (
              <Button
                type="button"
                className="loyalty-scan-action loyalty-stage loyalty-stage--1"
                onClick={() => window.dispatchEvent(new Event("scanner:open"))}
              >
                Escanear cliente
              </Button>
            )}

            <Card className="settings-card loyalty-stage loyalty-stage--2">
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
                      onClick={() => {
                        if (!window.confirm(`¿Eliminar la regla ${index + 1}?`))
                          return;
                        setData({
                          ...data,
                          purchaseRules: data.purchaseRules.filter(
                            (_, current) => current !== index,
                          ),
                        });
                      }}
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

            <Card className="settings-card loyalty-stage loyalty-stage--3">
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

            <Card className="settings-card simulator-card loyalty-stage loyalty-stage--2">
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
            <Card className="settings-card loyalty-review loyalty-stage loyalty-stage--4">
              <p className="page-eyebrow">Verifica antes de guardar</p>
              <LoyaltyCard current={previewUnits} goal={data.rewardUnits} rewardName={data.rewardName} />
              <dl>
                <div><dt>Estado</dt><dd>{data.enabled ? "Activo" : "Pausado"}</dd></div>
                <div><dt>Meta</dt><dd>{data.rewardUnits} unidades</dd></div>
                <div><dt>Recompensa</dt><dd>{data.rewardDiscountPercent}% · {data.rewardName || "Sin nombre"}</dd></div>
                <div><dt>Reglas</dt><dd>{data.purchaseRules.length} activas</dd></div>
                <div><dt>Ajustes manuales</dt><dd>{data.allowManualAdjustments ? "Permitidos" : "No permitidos"}</dd></div>
                <div><dt>Saldo negativo</dt><dd>{data.allowNegativeBalance ? "Permitido" : "No permitido"}</dd></div>
              </dl>
              {status && status !== "Configuración guardada" && (
                <div className="form-error" role="alert">
                  {status}{requestId && <small>Solicitud: {requestId}</small>}
                </div>
              )}
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
        <div className="loyalty-mobile-actions">
          {stage > 1 && (
            <Button type="button" variant="secondary" onClick={() => setStage(moveLoyaltyStage(stage, -1))}>
              Volver
            </Button>
          )}
          {stage < 4 ? (
            <Button type="button" onClick={() => setStage(moveLoyaltyStage(stage, 1))}>
              Continuar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (
                    loyaltySettingsChanged(data, original) &&
                    !window.confirm("¿Descartar los cambios sin guardar?")
                  )
                    return;
                  setData(original);
                  setStatus("");
                  setRequestId("");
                  setStage(1);
                }}
              >
                Cancelar
              </Button>
              <Button disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </>
          )}
        </div>
        <div className="sticky-save">
          <span>
            {status ||
              (loyaltySettingsChanged(data, original)
                ? "Hay cambios pendientes."
                : "Sin cambios pendientes.")}
          </span>
          <Button disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
      {status === "Configuración guardada" && <Toast>{status}</Toast>}
    </section>
  );
}
