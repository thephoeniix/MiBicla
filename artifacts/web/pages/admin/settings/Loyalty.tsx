import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  Toast,
} from "../../../components/ui";
import {
  editableLoyaltySettings,
  loyaltySettingsChanged,
} from "../../../lib/loyalty-settings";

interface Rule {
  minimumAmount: number;
  units: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const EMPTY = {
  enabled: false,
  currency: "MXN" as const,
  purchaseRules: [] as Rule[],
  rewardUnits: 10,
  rewardDiscountPercent: 10,
  rewardName: "",
  rewardDescription: "",
  allowManualAdjustments: false,
  allowNegativeBalance: false,
};

export function Loyalty({ permissions = [] }: { permissions?: string[] }) {
  const [data, setData] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [requestId, setRequestId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [adjustment, setAdjustment] = useState({
    customerId: "",
    units: 1,
    reason: "",
  });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentStatus, setAdjustmentStatus] = useState("");
  const canManage = permissions.includes("manage_loyalty");
  const canAdjust = permissions.includes("adjust_loyalty");

  function load() {
    setLoadState("loading");
    apiFetch<typeof EMPTY>("/api/admin/settings/loyalty")
      .then((result) => {
        const loaded = editableLoyaltySettings(result);
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

  useEffect(() => {
    load();
    if (canAdjust) {
      void apiFetch<{ items: Customer[] }>(
        "/api/admin/customers?search=&status=active&page=1&pageSize=100",
      )
        .then((result) => setCustomers(result.items))
        .catch(() => setAdjustmentStatus("No fue posible cargar los clientes."));
    }
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
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

  async function assignPoints(event: FormEvent) {
    event.preventDefault();
    if (!canAdjust || !adjustment.customerId || adjusting) return;
    setAdjusting(true);
    setAdjustmentStatus("");
    try {
      const result = await apiFetch<{
        availableUnits: number;
        rewardsCreated: number;
      }>(
        `/api/admin/customers/${adjustment.customerId}/loyalty-adjustments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            units: adjustment.units,
            reason: adjustment.reason,
          }),
        },
      );
      const customer = customers.find(
        (item) => item.id === adjustment.customerId,
      );
      setAdjustmentStatus(
        `${adjustment.units} ${adjustment.units === 1 ? "punto asignado" : "puntos asignados"} a ${customer?.firstName ?? "cliente"}. Saldo disponible: ${result.availableUnits}.${result.rewardsCreated ? ` Recompensas generadas: ${result.rewardsCreated}.` : ""}`,
      );
      setAdjustment((current) => ({ ...current, units: 1, reason: "" }));
    } catch (error) {
      setAdjustmentStatus(
        error instanceof ApiError
          ? error.message
          : "No fue posible asignar los puntos.",
      );
    } finally {
      setAdjusting(false);
    }
  }

  if (loadState === "loading")
    return <LoadingState label="Cargando programa de fidelidad…" />;
  if (loadState === "error")
    return <ErrorState message={status} onRetry={load} />;

  const normalizedSearch = customerSearch.trim().toLocaleLowerCase("es-MX");
  const visibleCustomers = normalizedSearch
    ? customers.filter((customer) =>
        `${customer.firstName} ${customer.lastName} ${customer.phone}`
          .toLocaleLowerCase("es-MX")
          .includes(normalizedSearch),
      )
    : customers;

  return (
    <section className="admin-page loyalty-settings loyalty-settings--simple">
      <PageHeader
        eyebrow="Loyalty"
        title="Programa de fidelidad"
        description="Configura la recompensa y asigna puntos a tus clientes."
      />

      <form className="loyalty-config-form" onSubmit={save}>
        <Card className="settings-card settings-card--status">
          <div>
            <p className="page-eyebrow">Estado del programa</p>
            <h2>{data.enabled ? "Programa activo" : "Programa pausado"}</h2>
            <p>
              {data.enabled
                ? "Los clientes pueden acumular puntos y obtener recompensas."
                : "La asignación de puntos está pausada."}
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={data.enabled}
              disabled={!canManage}
              onChange={(event) =>
                setData({ ...data, enabled: event.target.checked })
              }
            />
            <span aria-hidden="true" />
            <b>{data.enabled ? "Activo" : "Pausado"}</b>
          </label>
        </Card>

        <Card className="settings-card loyalty-reward-card">
          <header className="card-heading">
            <div>
              <p className="page-eyebrow">Configuración de recompensa</p>
              <h2>Define la meta y el beneficio</h2>
            </div>
          </header>
          <div className="form-grid">
            <label>
              Puntos necesarios
              <Input
                required
                type="number"
                min="1"
                disabled={!canManage}
                value={data.rewardUnits}
                onChange={(event) =>
                  setData({ ...data, rewardUnits: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Descuento de la recompensa
              <span className="input-suffix">
                <Input
                  required
                  type="number"
                  min="0"
                  max="100"
                  disabled={!canManage}
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
                required
                disabled={!canManage}
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
                disabled={!canManage}
                value={data.rewardDescription}
                onChange={(event) =>
                  setData({ ...data, rewardDescription: event.target.value })
                }
              />
            </label>
          </div>
          <div className="preference-list">
            <label>
              <input
                type="checkbox"
                checked={data.allowManualAdjustments}
                disabled={!canManage}
                onChange={(event) =>
                  setData({
                    ...data,
                    allowManualAdjustments: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Permitir asignación manual y por QR</strong>
                <small>El equipo podrá registrar puntos desde esta pantalla.</small>
              </span>
            </label>
          </div>
        </Card>

        {status && status !== "Configuración guardada" && (
          <div className="form-error" role="alert">
            {status}{requestId && <small>Solicitud: {requestId}</small>}
          </div>
        )}
        {canManage && (
          <footer className="loyalty-settings-actions">
            <span>
              {loyaltySettingsChanged(data, original)
                ? "Hay cambios pendientes."
                : "Configuración actualizada."}
            </span>
            <Button
              disabled={saving || !loyaltySettingsChanged(data, original)}
            >
              {saving ? "Guardando…" : "Guardar configuración"}
            </Button>
          </footer>
        )}
      </form>

      <Card className="settings-card loyalty-points-card">
        <header className="card-heading">
          <div>
            <p className="page-eyebrow">Asignación de puntos</p>
            <h2>Dar puntos a un cliente</h2>
            <p>Busca al cliente manualmente o identifica su cuenta con QR.</p>
          </div>
          {canAdjust && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.dispatchEvent(new Event("scanner:open"))}
            >
              Escanear QR
            </Button>
          )}
        </header>

        {!data.enabled || !data.allowManualAdjustments ? (
          <p className="form-notice">
            Activa el programa y la asignación manual, guarda la configuración y después podrás dar puntos.
          </p>
        ) : canAdjust ? (
          <form className="loyalty-adjustment-form" onSubmit={assignPoints}>
            <label className="form-span">
              Buscar cliente
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Nombre o teléfono"
              />
            </label>
            <label className="form-span">
              Cliente
              <Select
                required
                value={adjustment.customerId}
                onChange={(event) =>
                  setAdjustment({
                    ...adjustment,
                    customerId: event.target.value,
                  })
                }
              >
                <option value="">Selecciona un cliente</option>
                {visibleCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName} · {customer.phone}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Puntos
              <Input
                required
                type="number"
                min="1"
                step="1"
                value={adjustment.units}
                onChange={(event) =>
                  setAdjustment({
                    ...adjustment,
                    units: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Motivo
              <Input
                required
                value={adjustment.reason}
                onChange={(event) =>
                  setAdjustment({ ...adjustment, reason: event.target.value })
                }
                placeholder="Compra, visita o promoción"
              />
            </label>
            <Button
              className="form-span"
              disabled={
                adjusting ||
                !adjustment.customerId ||
                adjustment.units < 1 ||
                !adjustment.reason.trim()
              }
            >
              {adjusting ? "Asignando…" : "Asignar puntos"}
            </Button>
          </form>
        ) : (
          <p className="form-notice">No tienes permiso para asignar puntos.</p>
        )}
        {adjustmentStatus && (
          <p className="loyalty-adjustment-status" role="status">
            {adjustmentStatus}
          </p>
        )}
      </Card>

      {status === "Configuración guardada" && <Toast>{status}</Toast>}
    </section>
  );
}
