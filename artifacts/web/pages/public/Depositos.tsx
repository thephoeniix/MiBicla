import { useEffect, useRef, useState } from "react";
import { whatsappUrl } from "../../lib/business";
import { apiFetch } from "../../lib/api-client";
import { copyFinancialValue, formatFinancialNumber } from "../../lib/deposits";
import { bankLogo } from "../../lib/bank-logos";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { PublicShell } from "../../components/public/PublicShell";
import "./deposits.css";

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

function CardIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h2" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v2" /></svg>;
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function WhatsappIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.1A8 8 0 1 1 20 11.7Z" /><path d="M9 8.2c.2-.4.4-.4.7-.4h.3l.8 1.9c.1.2.1.4-.1.6l-.6.8c-.1.2 0 .4.1.6.7 1.2 1.6 2 2.8 2.6.3.1.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .4-.2 1.3-.8 1.8-.6.5-1.4.8-2.4.5-1.1-.3-2.5-.8-4.2-2.3-1.4-1.3-2.4-2.9-2.7-4-.3-1 .1-1.8.5-2.2.4-.4.8-.5 1.2-.5Z" /></svg>;
}

function AccountRow({
  label,
  value,
  icon,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  icon: "card" | "lock";
  copied: boolean;
  onCopy: () => void;
}) {
  const spoken = value.replace(/\D/g, "").split("").join(" ");
  return <div className="deposit-account-row">
    {icon === "card" ? <CardIcon /> : <LockIcon />}
    <span><small>{label}</small><strong aria-label={`${label}: ${spoken}`}>{formatFinancialNumber(value)}</strong></span>
    <button className={copied ? "is-copied" : ""} type="button" onClick={onCopy} aria-label={`Copiar ${label.toLocaleLowerCase("es")}`}><CopyIcon /><span>{copied ? "Copiado" : "Copiar"}</span></button>
  </div>;
}

function DepositAccount({ option }: { option: PublicDepositOption }) {
  const [copied, setCopied] = useState("");
  const [feedback, setFeedback] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy(label: string, value: string) {
    try {
      await copyFinancialValue(value);
      setCopied(label);
      setFeedback(label === "CLABE" ? "CLABE copiada" : `${label} copiado`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { setCopied(""); setFeedback(""); }, 2200);
    } catch {
      setFeedback("No pudimos copiar automáticamente. Mantén presionado el número para seleccionarlo.");
    }
  }

  const fields = [
    ["Número de tarjeta", option.cardNumber, "card"],
    ["Número de cuenta", option.accountNumber, "card"],
    ["CLABE", option.clabe, "lock"],
  ] as const;
  const visibleDetails = fields
    .filter((field): field is readonly [string, string, "card" | "lock"] => Boolean(field[1]))
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const receiptUrl = option.whatsappNumber && option.whatsappTemplate
    ? whatsappUrl(option.whatsappNumber, option.whatsappTemplate, {
        nombre: "",
        monto: "",
        concepto: option.referenceText,
        pedido: "",
        banco: option.bankName || option.displayName,
        titular: option.accountHolder || "",
        datos: visibleDetails,
      })
    : null;
  const logo = bankLogo(option.bankName || option.displayName);

  return <article className="deposit-account-card" role="tabpanel" id={`deposit-panel-${option.id}`} aria-labelledby={`deposit-tab-${option.id}`}>
    <header>
      <span className="deposit-bank-mark">{logo ? <img src={logo} alt={`Logo de ${option.bankName || option.displayName}`} /> : <CardIcon />}</span>
      <div><h2>{option.bankName || option.displayName}</h2>{option.accountHolder && <p>Titular: {option.accountHolder}</p>}</div>
    </header>
    <div className="deposit-account-fields">
      {fields.filter((field): field is readonly [string, string, "card" | "lock"] => Boolean(field[1])).map(([label, value, icon]) => <AccountRow key={label} label={label} value={value} icon={icon} copied={copied === label} onCopy={() => void copy(label, value)} />)}
    </div>
    {option.referenceText && <div className="deposit-reference"><small>Concepto o referencia</small><strong>{option.referenceText}</strong></div>}
    {option.instructions && <p className="deposit-account-instructions">{option.instructions}</p>}
    <p className="deposit-copy-feedback" role="status" aria-live="polite">{feedback}</p>
    {receiptUrl && <a className="deposit-whatsapp" href={receiptUrl} target="_blank" rel="noopener noreferrer"><WhatsappIcon />Enviar comprobante por WhatsApp</a>}
  </article>;
}

export function Depositos() {
  const [items, setItems] = useState<PublicDepositOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  function load() {
    setState("loading");
    apiFetch<{ items: PublicDepositOption[] }>("/api/public/depositos")
      .then((result) => {
        setItems(result.items);
        setSelectedId((current) => result.items.some(({ id }) => id === current) ? current : result.items[0]?.id ?? "");
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);
  const selected = items.find(({ id }) => id === selectedId) ?? items[0];

  return <PublicShell><div className="public-deposits-page">
    <section className="public-deposits-section">
      <header className="public-deposits-heading"><div><span>Información de pago</span><h1>Realiza tu <em>depósito.</em></h1></div><p>Selecciona una cuenta, copia los datos y envíanos tu comprobante por WhatsApp.</p></header>
      {state === "loading" && <LoadingState label="Cargando métodos…" />}
      {state === "error" && <ErrorState message="No pudimos consultar los métodos de pago." onRetry={load} />}
      {state === "ready" && (items.length ? <>
        <div className="deposit-bank-tabs" role="tablist" aria-label="Selecciona un método de pago">
          {items.map((option) => { const logo = bankLogo(option.bankName || option.displayName); return <button id={`deposit-tab-${option.id}`} key={option.id} type="button" role="tab" aria-selected={option.id === selected?.id} aria-controls={`deposit-panel-${option.id}`} onClick={() => setSelectedId(option.id)}><span>{logo ? <img src={logo} alt="" /> : <CardIcon />}</span><strong>{option.displayName}</strong></button>; })}
        </div>
        {selected && <div className="deposit-reference-layout"><DepositAccount key={selected.id} option={selected} /><aside className="deposit-safety-note"><span className="deposit-shield"><ShieldIcon /></span><small>Pago seguro</small><h2>Tu comprobante nos ayuda a confirmar el pago.</h2><p>Copia los datos de la cuenta seleccionada y envíanos una foto del comprobante. Solo lo usaremos para validar tu operación.</p><ol><li><span>1</span>Copia los datos</li><li><span>2</span>Realiza tu depósito</li><li><span>3</span>Envíanos el comprobante</li></ol></aside></div>}
      </> : <EmptyState title="Métodos de pago no disponibles" description="Por el momento no hay métodos de pago activos." />)}
    </section>
  </div></PublicShell>;
}
