import { useEffect, useRef, useState } from "react";
import { whatsappUrl } from "../../lib/business";
import { apiFetch } from "../../lib/api-client";
import {
  copyFinancialValue,
  formatFinancialNumber,
  maskedFinancialSummary,
} from "../../lib/deposits";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui";
import "./deposits.css";
import { PublicShell } from "../../components/public/PublicShell";
import { BrandLogo } from "../../components/brand";

export interface PublicDepositOption {
  id: string;
  displayName: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  clabe?: string;
  cardNumber?: string;
  referenceText: string;
  instructions: string;
  whatsappNumber: string;
  whatsappTemplate: string;
}

function DepositMethodCard({
  option,
  onOpen,
}: {
  option: PublicDepositOption;
  onOpen: () => void;
}) {
  const summary =
    maskedFinancialSummary(option.cardNumber) ||
    maskedFinancialSummary(option.clabe) ||
    maskedFinancialSummary(option.accountNumber);
  return (
    <button className="public-deposit-card" type="button" onClick={onOpen}>
      <span className="deposit-method-icon" aria-hidden="true">▤</span>
      <span>
        <small>Método de depósito</small>
        <strong>{option.displayName}</strong>
        <em>
          {[option.bankName, option.accountHolder, summary]
            .filter(Boolean)
            .join(" · ")}
        </em>
      </span>
      <i aria-hidden="true">›</i>
    </button>
  );
}

function CopyableFinancialField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="financial-field">
      <span>
        <small>{label}</small>
        <strong aria-label={`${label}: ${digitsForSpeech(value)}`}>
          {formatFinancialNumber(value)}
        </strong>
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copiar ${label.toLocaleLowerCase("es")}`}
      >
        <i aria-hidden="true">{copied ? "✓" : "□"}</i>
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

const digitsForSpeech = (value: string) =>
  value.replace(/\D/g, "").split("").join(" ");

function DepositMethodDetail({
  option,
  onClose,
}: {
  option: PublicDepositOption;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copyError, setCopyError] = useState("");
  const [receipt, setReceipt] = useState({
    nombre: "",
    monto: "",
    concepto: "",
    pedido: "",
    banco: option.bankName ?? "",
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

  async function copy(label: string, value: string) {
    try {
      await copyFinancialValue(value);
      setCopied(label);
      setCopyError("");
      setFeedback(
        label === "CLABE" ? "CLABE copiada" : `${label} copiado`,
      );
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied("");
        setFeedback("");
      }, 2500);
    } catch {
      setCopyError(
        "No pudimos copiar automáticamente. Mantén presionado el número para seleccionarlo.",
      );
    }
  }

  const fields = [
    ["Número de tarjeta", option.cardNumber],
    ["Número de cuenta", option.accountNumber],
    ["CLABE", option.clabe],
  ] as const;

  return (
    <dialog
      ref={dialogRef}
      className="public-deposit-detail"
      aria-modal="true"
      aria-labelledby="deposit-detail-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <button type="button" onClick={onClose} aria-label="Volver a métodos">
          ‹
        </button>
        <span>Datos de depósito</span>
      </header>
      <div className="deposit-detail-shell">
        <section className="deposit-wallet-card">
          <div>
            <img src="/white-simple.png" alt="" />
            <span>Método de depósito</span>
          </div>
          <h1 id="deposit-detail-title">{option.displayName}</h1>
          {option.accountHolder && (
            <p><small>Titular</small><strong>{option.accountHolder}</strong></p>
          )}
          {option.bankName && (
            <p><small>Institución</small><strong>{option.bankName}</strong></p>
          )}
        </section>

        <section className="deposit-data-sheet">
          {fields
            .filter(
              (field): field is readonly [string, string] =>
                Boolean(field[1]),
            )
            .map(([label, value]) => (
              <CopyableFinancialField
                key={label}
                label={label}
                value={value}
                copied={copied === label}
                onCopy={() => void copy(label, value)}
              />
            ))}
          {option.referenceText && (
            <div className="deposit-reference">
              <small>Concepto o referencia</small>
              <strong>{option.referenceText}</strong>
            </div>
          )}
          {option.instructions && (
            <div className="deposit-instructions">
              <i aria-hidden="true">i</i>
              <p>{option.instructions}</p>
            </div>
          )}
          <p className="deposit-copy-feedback" aria-live="polite">
            {feedback || copyError}
          </p>
        </section>

        {option.whatsappNumber && option.whatsappTemplate && (
          <details className="receipt-share">
            <summary>Compartir comprobante</summary>
            <div>
              {(["nombre", "monto", "concepto", "pedido"] as const).map(
                (key) => (
                  <label key={key}>
                    {key === "nombre"
                      ? "Nombre"
                      : key === "monto"
                        ? "Monto"
                        : key === "concepto"
                          ? "Concepto"
                          : "Pedido"}
                    <input
                      value={receipt[key]}
                      onChange={(event) =>
                        setReceipt({
                          ...receipt,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </label>
                ),
              )}
              <a
                target="_blank"
                rel="noreferrer"
                href={whatsappUrl(
                  option.whatsappNumber,
                  option.whatsappTemplate,
                  receipt,
                )}
              >
                Abrir WhatsApp
              </a>
              <small>
                Esta acción sólo comparte el comprobante; no confirma la
                recepción del depósito.
              </small>
            </div>
          </details>
        )}
      </div>
    </dialog>
  );
}

export function Depositos() {
  const [items, setItems] = useState<PublicDepositOption[]>([]);
  const [selected, setSelected] = useState<PublicDepositOption | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  function load() {
    setState("loading");
    apiFetch<{ items: PublicDepositOption[] }>("/api/public/depositos")
      .then((result) => {
        setItems(result.items);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  return (
    <PublicShell><div className="public-deposits-page">
      <div className="public-page-container public-deposits-shell">
        <header className="public-deposits-header">
          <BrandLogo variant="symbol" color="pink" decorative />
          <div><small>Mi Bicla Querétaro</small><h1>Depósitos</h1></div>
        </header>
        <p className="public-deposits-intro">
          Elige el método que prefieras y copia los datos para realizar tu
          depósito desde la aplicación de tu banco.
        </p>
        {state === "loading" && <LoadingState label="Cargando métodos…" />}
        {state === "error" && (
          <ErrorState
            message="No pudimos consultar los métodos de depósito."
            onRetry={load}
          />
        )}
        {state === "ready" && (
          items.length ? (
            <section className="deposit-method-list" aria-label="Métodos disponibles">
              {items.map((option) => (
                <DepositMethodCard
                  key={option.id}
                  option={option}
                  onOpen={() => setSelected(option)}
                />
              ))}
            </section>
          ) : (
            <EmptyState
              title="Depósitos no disponibles"
              description="Por el momento no hay métodos de depósito activos."
            />
          )
        )}
        <footer>
          <img src="/pink-simple.png" alt="" />
          <span>Pedalea · disfruta · repite</span>
        </footer>
      </div>
      {selected && (
        <DepositMethodDetail
          option={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div></PublicShell>
  );
}
