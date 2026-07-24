import type {
  ButtonHTMLAttributes,
  DialogHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <article className={`ui-card ${className}`.trim()} {...props} />;
}

export function PageContent({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`page-content ${className}`.trim()} {...props} />;
}

export function PageSection({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={`page-section ${className}`.trim()} {...props} />;
}

export function ResponsiveGrid({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`responsive-grid ${className}`.trim()} {...props} />;
}

export function ActionBar({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`action-bar ${className}`.trim()} {...props} />;
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Card className="metric-card">
      <small>{label}</small>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </Card>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ui-input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="ui-input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="ui-input ui-textarea" {...props} />;
}

export function Modal({
  className = "",
  ...props
}: DialogHTMLAttributes<HTMLDialogElement>) {
  return <dialog className={`ui-modal ${className}`.trim()} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  received: "Recibida",
  inspection: "Inspección",
  diagnosis: "Diagnóstico",
  diagnosed: "Diagnóstico",
  waiting_approval: "Esperando aprobación",
  approved: "Aprobada",
  in_progress: "En reparación",
  waiting_parts: "Esperando piezas",
  quality_check: "Control de calidad",
  ready: "Lista para recoger",
  delivered: "Entregada",
  cancelled: "Cancelada",
  pending: "Pendiente",
  completed: "Completado",
  planned: "Planeada",
  available: "Disponible",
  redeemed: "Canjeada",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {statusLabel(status)}
    </span>
  );
}

export function Tabs({
  items,
  active,
  onChange,
  label,
}: {
  items: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          tabIndex={active === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const current = items.findIndex(({ id }) => id === active);
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const next = (current + direction + items.length) % items.length;
            onChange(items[next]!.id);
            const buttons =
              event.currentTarget.parentElement?.querySelectorAll("button");
            buttons?.[next]?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="ui-state">
      <span aria-hidden="true">○</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="ui-state" role="status" aria-live="polite">
      <i className="ui-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <strong>No pudimos cargar esta sección</strong>
      <p>{message}</p>
      {onRetry && (
        <Button type="button" variant="secondary" onClick={onRetry}>
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="ui-toast" role="status">
      {children}
    </div>
  );
}

export const WORKSHOP_STEPS = [
  "received",
  "diagnosis",
  "approved",
  "in_progress",
  "ready",
  "delivered",
] as const;

function normalizedStep(status: string) {
  const translated: Record<string, string> = {
    recibida: "received",
    inspección: "received",
    diagnostico: "diagnosis",
    diagnóstico: "diagnosis",
    aprobada: "approved",
    "en reparación": "in_progress",
    "lista para recoger": "ready",
    entregada: "delivered",
  };
  const normalizedLabel = translated[status.trim().toLocaleLowerCase("es")];
  if (normalizedLabel) return normalizedLabel;
  if (status === "inspection") return "received";
  if (status === "diagnosed") return "diagnosis";
  if (status === "waiting_approval") return "diagnosis";
  if (status === "waiting_parts" || status === "quality_check")
    return "in_progress";
  return status;
}

export function Stepper({ status }: { status: string }) {
  const current = WORKSHOP_STEPS.indexOf(
    normalizedStep(status) as (typeof WORKSHOP_STEPS)[number],
  );
  return (
    <ol className="ui-stepper" aria-label="Progreso de la orden">
      {WORKSHOP_STEPS.map((step, index) => (
        <li
          key={step}
          className={
            index < current
              ? "is-complete"
              : index === current
                ? "is-current"
                : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <i aria-hidden="true">
            {index < current ? "✓" : index === current ? "●" : "○"}
          </i>
          <span>{statusLabel(step)}</span>
        </li>
      ))}
    </ol>
  );
}
