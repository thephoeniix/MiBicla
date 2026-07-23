import { useEffect, useId, useMemo, useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
  searchText?: string;
}

interface Props {
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  allowOther?: boolean;
}

export function SearchableCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  disabled,
  loading,
  emptyMessage = "No se encontraron resultados.",
  allowOther,
}: Props) {
  const id = useId();
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const available = useMemo(
    () => [
      ...options,
      ...(allowOther ? [{ value: "__other__", label: "Otro" }] : []),
    ],
    [allowOther, options],
  );
  const filtered = available.filter((option) =>
    `${option.label} ${option.searchText ?? ""}`
      .toLocaleLowerCase("es")
      .includes(query.toLocaleLowerCase("es")),
  );
  const selectedLabel =
    available.find((option) => option.value === value)?.label ?? "";
  useEffect(() => {
    if (value) setQuery(selectedLabel);
  }, [selectedLabel, value]);
  const choose = (option: ComboboxOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <label className="combobox">
      {label}
      <span className="combobox-input">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={loading ? "Cargando…" : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                Math.min(current + 1, filtered.length - 1),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && open && filtered[active]) {
              event.preventDefault();
              choose(filtered[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {value && (
          <button
            type="button"
            className="combobox-clear"
            aria-label={`Limpiar ${label.toLocaleLowerCase("es")}`}
            onClick={() => {
              onChange("");
              setQuery("");
            }}
          >
            ×
          </button>
        )}
      </span>
      {open && !disabled && (
        <ul id={`${id}-options`} role="listbox" className="combobox-options">
          {filtered.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
            >
              <button
                type="button"
                className={index === active ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
          {!loading && filtered.length === 0 && <li>{emptyMessage}</li>}
        </ul>
      )}
    </label>
  );
}
