import { useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api-client";
import {
  BICYCLE_BRANDS,
  BICYCLE_COLORS,
  BICYCLE_CONDITIONS,
  BICYCLE_TYPES,
  BRAKE_TYPES,
  DRIVETRAINS,
  SUSPENSION_TYPES,
  WHEEL_SIZES,
} from "../lib/bicycle-catalogs";
import { SearchableCombobox } from "./SearchableCombobox";
import { Dialog } from "./ui";

export interface Bicycle {
  id: string;
  customerId: string | null;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  bikeType: string | null;
  color: string | null;
  wheelSize: string | null;
  brakeType: string | null;
  suspensionType: string | null;
  drivetrain: string | null;
  generalCondition: string | null;
}

const EMPTY = {
  nickname: "",
  brand: "",
  model: "",
  bikeType: "",
  color: "",
  wheelSize: "",
  year: "",
  brakeType: "",
  suspensionType: "",
  drivetrain: "",
  serialNumber: "",
  frameNumber: "",
  generalCondition: "",
  notes: "",
};
type Field = keyof typeof EMPTY;

function CatalogField({
  label,
  field,
  options,
  form,
  setForm,
}: {
  label: string;
  field: Field;
  options: string[];
  form: typeof EMPTY;
  setForm: (form: typeof EMPTY) => void;
}) {
  const [isOther, setIsOther] = useState(false);
  return (
    <>
      <SearchableCombobox
        label={label}
        options={options.map((option) => ({ value: option, label: option }))}
        value={isOther ? "__other__" : form[field]}
        onChange={(value) => {
          setIsOther(value === "__other__");
          setForm({ ...form, [field]: value === "__other__" ? "" : value });
        }}
        allowOther
      />
      {isOther && (
        <label>
          {label} personalizada
          <input
            value={form[field]}
            placeholder={`Escribe ${label.toLocaleLowerCase("es")}`}
            onChange={(event) =>
              setForm({ ...form, [field]: event.target.value })
            }
          />
        </label>
      )}
    </>
  );
}

export function BicycleForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string;
  onCreated: (bicycle: Bicycle) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const bicycle = await apiFetch<Bicycle>("/api/admin/bicycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId,
          ...form,
          year: form.year ? Number(form.year) : null,
          status: "active",
        }),
      });
      onCreated(bicycle);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar.",
      );
    }
  }
  return (
    <Dialog open aria-labelledby="bicycle-title">
      <form onSubmit={submit} className="bicycle-form">
        <h3 id="bicycle-title">Registrar bicicleta</h3>
        <fieldset>
          <legend>Información general</legend>
          <label>
            Apodo
            <input
              value={form.nickname}
              onChange={(event) =>
                setForm({ ...form, nickname: event.target.value })
              }
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Características</legend>
          <CatalogField
            label="Marca"
            field="brand"
            options={BICYCLE_BRANDS}
            form={form}
            setForm={setForm}
          />
          <label>
            Modelo
            <input
              value={form.model}
              onChange={(event) =>
                setForm({ ...form, model: event.target.value })
              }
            />
          </label>
          <CatalogField
            label="Tipo"
            field="bikeType"
            options={BICYCLE_TYPES}
            form={form}
            setForm={setForm}
          />
          <CatalogField
            label="Color"
            field="color"
            options={BICYCLE_COLORS}
            form={form}
            setForm={setForm}
          />
          <CatalogField
            label="Rodada"
            field="wheelSize"
            options={WHEEL_SIZES}
            form={form}
            setForm={setForm}
          />
          <label>
            Año
            <input
              type="number"
              min="1900"
              max="2100"
              value={form.year}
              onChange={(event) =>
                setForm({ ...form, year: event.target.value })
              }
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Componentes</legend>
          <CatalogField
            label="Tipo de frenos"
            field="brakeType"
            options={BRAKE_TYPES}
            form={form}
            setForm={setForm}
          />
          <CatalogField
            label="Suspensión"
            field="suspensionType"
            options={SUSPENSION_TYPES}
            form={form}
            setForm={setForm}
          />
          <CatalogField
            label="Transmisión"
            field="drivetrain"
            options={DRIVETRAINS}
            form={form}
            setForm={setForm}
          />
        </fieldset>
        <fieldset>
          <legend>Identificación</legend>
          <label>
            Número de serie
            <input
              value={form.serialNumber}
              onChange={(event) =>
                setForm({ ...form, serialNumber: event.target.value })
              }
            />
          </label>
          <label>
            Número de cuadro
            <input
              value={form.frameNumber}
              onChange={(event) =>
                setForm({ ...form, frameNumber: event.target.value })
              }
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Estado</legend>
          <SearchableCombobox
            label="Estado general"
            options={BICYCLE_CONDITIONS.map((option) => ({
              value: option,
              label: option,
            }))}
            value={form.generalCondition}
            onChange={(generalCondition) =>
              setForm({ ...form, generalCondition })
            }
          />
        </fieldset>
        <fieldset>
          <legend>Notas</legend>
          <label>
            Observaciones internas
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="actions">
          <button type="submit">Guardar bicicleta</button>
          <button type="button" className="secondary" aria-label="Cerrar formulario de bicicleta" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
