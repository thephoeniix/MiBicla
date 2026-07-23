import { useEffect, useRef, useState } from "react";
import { copyText, whatsappUrl } from "../../lib/business";
import { apiFetch } from "../../lib/api-client";
interface Option {
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
export function Depositos() {
  const [items, setItems] = useState<Option[]>([]),
    [copied, setCopied] = useState(""),
    [values, setValues] = useState({
      nombre: "",
      monto: "",
      concepto: "",
      pedido: "",
      banco: "",
    });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    apiFetch<{ items: Option[] }>("/api/public/depositos")
      .then((x) => setItems(x.items))
      .catch(() => setItems([]));
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy(key: string, value: string) {
    await copyText(value);
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(""), 2000);
  }
  return (
    <main>
      <h1>Depósitos</h1>
      {items.length === 0 ? (
        <p>Los depósitos no están disponibles.</p>
      ) : (
        items.map((option) => {
          const fields = [
            ["Banco", option.bankName],
            ["Titular", option.accountHolder],
            ["Cuenta", option.accountNumber],
            ["CLABE", option.clabe],
            ["Tarjeta", option.cardNumber],
            ["Concepto", option.referenceText],
            ["Instrucciones", option.instructions],
          ] as const;
          return (
            <article className="deposit-card" key={option.id}>
              <h2>{option.displayName}</h2>
              {fields
                .filter((x): x is readonly [string, string] => Boolean(x[1]))
                .map(([label, value]) => {
                  const key = `${option.id}-${label}`;
                  return (
                    <div className="copy-row" key={key}>
                      <span>
                        <small>{label}</small>
                        <strong>{value}</strong>
                      </span>
                      <button type="button" onClick={() => copy(key, value)}>
                        {copied === key ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  );
                })}
              <section className="receipt">
                {(["nombre", "monto", "concepto", "pedido"] as const).map(
                  (k) => (
                    <label key={k}>
                      {k}
                      <input
                        value={values[k]}
                        onChange={(e) =>
                          setValues({ ...values, [k]: e.target.value })
                        }
                      />
                    </label>
                  ),
                )}
                <a
                  className="button"
                  target="_blank"
                  rel="noreferrer"
                  href={whatsappUrl(
                    option.whatsappNumber,
                    option.whatsappTemplate,
                    { ...values, banco: option.bankName ?? "" },
                  )}
                >
                  Enviar comprobante por WhatsApp
                </a>
              </section>
            </article>
          );
        })
      )}
    </main>
  );
}
