import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { Button, StatusBadge } from "../ui";
import { QrScanner } from "./QrScanner";
import {
  customerAdminProfileUrl,
  extractCustomerToken,
} from "./scanner-utils";
import "./scanner.css";

interface ScanResult {
  customer: { id: string; name: string };
  balance: {
    availableUnits: number;
    pendingUnits: number;
    lifetimeUnits: number;
    updatedAt: string;
  };
  rewards: Array<{ id: string; rewardName: string; status: string }>;
  loyaltyProgram: {
    enabled: boolean;
    rewardUnits: number;
    rewardName: string;
    allowManualAdjustments: boolean;
  } | null;
}

type FlowState =
  | "scanner"
  | "resolving"
  | "customer"
  | "confirm"
  | "saving"
  | "success"
  | "error";

function ScanFallbackInput({
  onSubmit,
}: {
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="scan-fallback"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label>
        URL o código del cliente
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Pega el enlace o usa un lector USB"
        />
      </label>
      <Button>Identificar cliente</Button>
    </form>
  );
}

function ScannerErrorState({
  message,
  onRetry,
  onManual,
}: {
  message: string;
  onRetry: () => void;
  onManual: () => void;
}) {
  return (
    <div className="scanner-error" role="alert">
      <span aria-hidden="true">!</span>
      <strong>No pudimos continuar</strong>
      <p>{message}</p>
      <div className="scanner-actions">
        <Button type="button" onClick={onManual}>Ingresar enlace manualmente</Button>
        <Button type="button" variant="secondary" onClick={onRetry}>Reintentar cámara</Button>
      </div>
    </div>
  );
}

function LoyaltyGrid({
  current,
  goal,
  animateLast = false,
}: {
  current: number;
  goal: number;
  animateLast?: boolean;
}) {
  const icons = Math.min(goal, 10);
  const earned =
    goal > 0
      ? Math.min(icons, Math.floor((Math.max(current, 0) / goal) * icons))
      : 0;
  return (
    <div className="scan-loyalty-grid" aria-hidden="true">
      {Array.from({ length: icons }, (_, index) => (
        <img
          key={index}
          className={animateLast && index === earned - 1 ? "is-new" : ""}
          src={index < earned ? "/pink-simple.png" : "/black-simple.png"}
          alt=""
        />
      ))}
    </div>
  );
}

function CustomerScanResult({
  result,
  onConfirm,
  onCancel,
}: {
  result: ScanResult;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const goal = result.loyaltyProgram?.rewardUnits;
  return (
    <section className="scan-customer">
      <header>
        <span aria-hidden="true">
          {result.customer.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")}
        </span>
        <div>
          <p className="page-eyebrow">Cliente identificado</p>
          <h2>{result.customer.name}</h2>
          <small>
            Actualizado{" "}
            {new Date(result.balance.updatedAt).toLocaleString("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </small>
        </div>
      </header>
      <div className="scan-balance">
        <div>
          <small>Unidades disponibles</small>
          <strong>{result.balance.availableUnits}</strong>
        </div>
        <div>
          <small>Recompensas</small>
          <strong>{result.rewards.length}</strong>
        </div>
      </div>
      {goal && result.loyaltyProgram?.enabled ? (
        <div className="scan-progress">
          <div>
            <span>Progreso</span>
            <strong>{result.balance.availableUnits} / {goal}</strong>
          </div>
          <LoyaltyGrid current={result.balance.availableUnits} goal={goal} />
          <p>
            {Math.max(goal - result.balance.availableUnits, 0)} unidades para{" "}
            {result.loyaltyProgram.rewardName}.
          </p>
        </div>
      ) : (
        <p className="scanner-notice">El programa de fidelidad no está activo.</p>
      )}
      {result.rewards.length > 0 && (
        <div className="scan-rewards">
          {result.rewards.map((reward) => (
            <div key={reward.id}>
              <span>{reward.rewardName}</span>
              <StatusBadge status={reward.status} />
            </div>
          ))}
        </div>
      )}
      <div className="scanner-actions">
        <a
          className="ui-button ui-button--secondary"
          href={customerAdminProfileUrl(result.customer.id)}
        >
          Abrir perfil del cliente
        </a>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={
            !result.loyaltyProgram?.enabled ||
            !result.loyaltyProgram.allowManualAdjustments
          }
        >
          Registrar 1 unidad
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {!result.loyaltyProgram?.allowManualAdjustments && (
        <small className="scanner-help">
          Los ajustes manuales están desactivados en la configuración.
        </small>
      )}
    </section>
  );
}

function LoyaltyAdjustmentConfirm({
  customerName,
  reason,
  onReasonChange,
  onSubmit,
  saving,
  error,
}: {
  customerName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  saving: boolean;
  error: { message: string; requestId?: string } | null;
}) {
  return (
    <form className="scan-confirm" onSubmit={onSubmit}>
      <span className="scan-confirm-icon" aria-hidden="true">+1</span>
      <p className="page-eyebrow">Confirmar movimiento</p>
      <h2>¿Registrar una unidad para {customerName}?</h2>
      <p>Esta acción creará un ajuste manual auditado.</p>
      <label>
        Motivo
        <select
          required
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        >
          <option value="">Selecciona un motivo</option>
          <option value="Compra en tienda">Compra en tienda</option>
          <option value="Servicio de taller">Servicio de taller</option>
          <option value="Promoción">Promoción</option>
          <option value="Corrección autorizada">Corrección autorizada</option>
        </select>
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error.message}
          {error.requestId && <small>Solicitud: {error.requestId}</small>}
        </div>
      )}
      <div className="scanner-actions">
        <Button disabled={saving || !reason}>
          {saving ? "Registrando…" : "Confirmar y registrar"}
        </Button>
      </div>
    </form>
  );
}

export function CustomerScanFlow({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<FlowState>("scanner");
  const [manual, setManual] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{
    message: string;
    requestId?: string;
  } | null>(null);
  const [success, setSuccess] = useState<{
    before: number;
    after: number;
    rewardsCreated: number;
    goal: number;
  } | null>(null);

  if (!open) return null;

  function reset() {
    setState("scanner");
    setManual(false);
    setResult(null);
    setReason("");
    setError(null);
    setSuccess(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function resolve(rawValue: string) {
    const token = extractCustomerToken(rawValue);
    if (!token) {
      setError({ message: "El código no corresponde a una tarjeta Mi Bicla." });
      setState("error");
      return;
    }
    setState("resolving");
    setError(null);
    try {
      const found = await apiFetch<ScanResult>(
        "/api/admin/customers/resolve-token",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        },
      );
      setResult(found);
      setState("customer");
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setError({
        message:
          apiError?.status === 404
            ? "No encontramos un cliente activo para este código."
            : apiError?.message ?? "No fue posible identificar al cliente.",
        requestId: apiError?.requestId,
      });
      setState("error");
    }
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!result) return;
    const before = result.balance.availableUnits;
    setState("saving");
    setError(null);
    try {
      const adjustment = await apiFetch<{
        availableUnits: number;
        rewardsCreated: number;
      }>(
        `/api/admin/customers/${result.customer.id}/loyalty-adjustments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ units: 1, reason }),
        },
      );
      setSuccess({
        before,
        after: adjustment.availableUnits,
        rewardsCreated: adjustment.rewardsCreated,
        goal: result.loyaltyProgram?.rewardUnits ?? 0,
      });
      setState("success");
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setError({
        message: apiError?.message ?? "No fue posible registrar la unidad.",
        requestId: apiError?.requestId,
      });
      setState("confirm");
    }
  }

  return (
    <dialog
      open
      className="scanner-modal"
      aria-modal="true"
      aria-labelledby="scanner-title"
    >
      <header className="scanner-header">
        <div>
          <p>Mi Bicla</p>
          <h1 id="scanner-title">Escanear cliente</h1>
        </div>
        <button type="button" aria-label="Cerrar escáner" onClick={close}>×</button>
      </header>
      <div className="scanner-body">
        {state === "scanner" && !manual && (
          <>
            <QrScanner
              onDetected={(value) => void resolve(value)}
              onError={(message) => {
                setError({ message });
                setState("error");
              }}
            />
            <button
              type="button"
              className="scanner-manual-link"
              onClick={() => setManual(true)}
            >
              Ingresar código manualmente
            </button>
          </>
        )}
        {state === "scanner" && manual && (
          <>
            <ScanFallbackInput onSubmit={(value) => void resolve(value)} />
            <button
              type="button"
              className="scanner-manual-link"
              onClick={() => setManual(false)}
            >
              Volver a la cámara
            </button>
            <a className="scanner-customer-search" href="/admin/customers">
              Buscar cliente manualmente
            </a>
          </>
        )}
        {state === "resolving" && (
          <div className="scanner-loading" role="status">
            <i aria-hidden="true" />
            <strong>Buscando cliente…</strong>
          </div>
        )}
        {state === "error" && error && (
          <>
            <ScannerErrorState
              message={error.message}
              onRetry={() => {
                setError(null);
                setState("scanner");
              }}
              onManual={() => {
                setError(null);
                setManual(true);
                setState("scanner");
              }}
            />
            {error.requestId && (
              <small className="scanner-request-id">
                Solicitud: {error.requestId}
              </small>
            )}
          </>
        )}
        {state === "customer" && result && (
          <CustomerScanResult
            result={result}
            onConfirm={() => setState("confirm")}
            onCancel={reset}
          />
        )}
        {(state === "confirm" || state === "saving") && result && (
          <LoyaltyAdjustmentConfirm
            customerName={result.customer.name}
            reason={reason}
            onReasonChange={setReason}
            onSubmit={(event) => void submitAdjustment(event)}
            saving={state === "saving"}
            error={error}
          />
        )}
        {state === "success" && result && success && (
          <section className="scan-success">
            <span aria-hidden="true">✓</span>
            <p className="page-eyebrow">Movimiento registrado</p>
            <h2>¡Unidad agregada!</h2>
            {success.rewardsCreated > 0 && (
              <strong className="reward-unlocked">
                ¡Recompensa desbloqueada!
              </strong>
            )}
            <div className="scan-success-balance">
              <div><small>Saldo anterior</small><strong>{success.before}</strong></div>
              <i aria-hidden="true">+1</i>
              <div><small>Saldo nuevo</small><strong>{success.after}</strong></div>
            </div>
            {success.goal > 0 && (
              <LoyaltyGrid
                current={success.after}
                goal={success.goal}
                animateLast
              />
            )}
            <Button type="button" onClick={close}>Finalizar</Button>
            <Button type="button" variant="secondary" onClick={reset}>
              Escanear otro cliente
            </Button>
          </section>
        )}
      </div>
    </dialog>
  );
}
