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
import { FormDialog } from "./ui";

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
  year?: number | null;
  serialNumber?: string | null;
  frameNumber?: string | null;
  notes?: string | null;
  status: string;
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

function formFromBicycle(bicycle?: Bicycle | null): typeof EMPTY {
  if (!bicycle) return EMPTY;
  return {
    nickname: bicycle.nickname ?? "",
    brand: bicycle.brand ?? "",
    model: bicycle.model ?? "",
    bikeType: bicycle.bikeType ?? "",
    color: bicycle.color ?? "",
    wheelSize: bicycle.wheelSize ?? "",
    year: bicycle.year?.toString() ?? "",
    brakeType: bicycle.brakeType ?? "",
    suspensionType: bicycle.suspensionType ?? "",
    drivetrain: bicycle.drivetrain ?? "",
    serialNumber: bicycle.serialNumber ?? "",
    frameNumber: bicycle.frameNumber ?? "",
    generalCondition: bicycle.generalCondition ?? "",
    notes: bicycle.notes ?? "",
  };
}

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
  const [isOther, setIsOther] = useState(
    () => Boolean(form[field]) && !options.includes(form[field]),
  );
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
  bicycle,
  onSaved,
  onCancel,
}: {
  customerId: string;
  onCreated: (bicycle: Bicycle) => void;
  bicycle?: Bicycle | null;
  onSaved?: (bicycle: Bicycle) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => formFromBicycle(bicycle));
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const saved = await apiFetch<Bicycle>(
        bicycle ? `/api/admin/bicycles/${bicycle.id}` : "/api/admin/bicycles",
        {
        method: bicycle ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(bicycle ? {} : { customerId }),
          ...form,
          year: form.year ? Number(form.year) : null,
          status: bicycle?.status ?? "active",
        }),
      });
      if (bicycle) onSaved?.(saved);
      else onCreated(saved);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar.",
      );
    }
  }
  return (
    <FormDialog open aria-labelledby="bicycle-title">
      <form onSubmit={submit} className="bicycle-form">
        <h3 id="bicycle-title" className="form-dialog-header">{bicycle ? "Editar bicicleta" : "Registrar bicicleta"}</h3>
        <div className="form-dialog-body">
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
        </div>
        <div className="actions form-dialog-actions">
          <button type="submit">{bicycle ? "Guardar cambios" : "Guardar bicicleta"}</button>
          <button type="button" data-dialog-close className="secondary" aria-label="Cerrar formulario de bicicleta" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
