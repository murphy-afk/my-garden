import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import {
  areaGrid,
  areaKinds,
  areaKeys,
  createArea,
  kindLabel,
  updateArea,
  type AreaGeometry,
  type AreaInput,
  type AreaKind,
  type GardenArea,
} from '../api/areas';

export type FormTarget = { mode: 'create'; geometry: AreaGeometry } | { mode: 'edit'; area: GardenArea };

type AreaFormProps = {
  target: FormTarget;
  onClose: () => void;
};

/** Every control holds a string; counts are converted on the way out. */
type FormValues = {
  name: string;
  kind: AreaKind;
  widthCm: string;
  depthCm: string;
  gridX: string;
  gridY: string;
  notes: string;
};

function initialValues(target: FormTarget): FormValues {
  if (target.mode === 'create') {
    return {
      name: '',
      kind: 'bed',
      widthCm: String(target.geometry.widthCm),
      depthCm: String(target.geometry.depthCm),
      gridX: String(target.geometry.gridX),
      gridY: String(target.geometry.gridY),
      notes: '',
    };
  }

  const area = target.area;
  return {
    name: area.name,
    kind: area.kind,
    widthCm: String(area.widthCm),
    depthCm: String(area.depthCm),
    gridX: String(area.gridX),
    gridY: String(area.gridY),
    notes: area.notes ?? '',
  };
}

function readCount(raw: string): number {
  const trimmed = raw.trim();
  // Blank reads as 0; the required attribute stops that reaching the server,
  // and the API would reject it with a field message if it did.
  return trimmed === '' ? 0 : Number(trimmed);
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function AreaForm({ target, onClose }: AreaFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: AreaInput) =>
      target.mode === 'create' ? createArea(input) : updateArea(target.area.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areaKeys.all });
      onClose();
    },
  });

  const fieldErrors = readFieldErrors(save.error);
  const formError =
    save.error !== null && Object.keys(fieldErrors).length === 0 ? messageFor(save.error) : null;

  /** Replaces part of the form. Editing also drops the previous server answer. */
  function change(patch: Partial<FormValues>): void {
    setValues((current) => ({ ...current, ...patch }));
    if (save.isError) save.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const input: AreaInput = {
      name: values.name.trim(),
      kind: values.kind,
      widthCm: readCount(values.widthCm),
      depthCm: readCount(values.depthCm),
      gridX: readCount(values.gridX),
      gridY: readCount(values.gridY),
      notes: readText(values.notes),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Create area' : 'Save changes';
  const gridColumnsMax = areaGrid.columns - 1;
  const gridRowsMax = areaGrid.rows - 1;

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="area-form-heading">
      <h2 className="form-card__title" id="area-form-heading">
        {target.mode === 'create' ? 'New area' : `Edit ${target.area.name}`}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="area-name">Name</label>
          <input
            id="area-name"
            className="input"
            type="text"
            required
            maxLength={120}
            autoFocus
            value={values.name}
            onChange={(event) => change({ name: event.target.value })}
            aria-invalid={fieldErrors['name'] !== undefined}
            aria-describedby="area-name-error" />
          <p className="field__error" id="area-name-error">{fieldErrors['name']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="area-kind">Type</label>
          <select
            id="area-kind"
            className="select"
            value={values.kind}
            onChange={(event) => change({ kind: event.target.value as AreaKind })}
            aria-invalid={fieldErrors['kind'] !== undefined}
            aria-describedby="area-kind-error">
            {areaKinds.map((kind) => (
              <option key={kind} value={kind}>{kindLabel(kind)}</option>
            ))}
          </select>
          <p className="field__error" id="area-kind-error">{fieldErrors['kind']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="area-width">Width (cm)</label>
          <input
            id="area-width"
            className="input"
            type="number"
            required
            min={areaGrid.minAreaCm}
            max={areaGrid.columns * areaGrid.cellWidthCm}
            step={1}
            value={values.widthCm}
            onChange={(event) => change({ widthCm: event.target.value })}
            aria-invalid={fieldErrors['widthCm'] !== undefined}
            aria-describedby="area-width-error" />
          <p className="field__error" id="area-width-error">{fieldErrors['widthCm']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="area-depth">Depth (cm)</label>
          <input
            id="area-depth"
            className="input"
            type="number"
            required
            min={areaGrid.minAreaCm}
            max={areaGrid.rows * areaGrid.cellHeightCm}
            step={1}
            value={values.depthCm}
            onChange={(event) => change({ depthCm: event.target.value })}
            aria-invalid={fieldErrors['depthCm'] !== undefined}
            aria-describedby="area-depth-error" />
          <p className="field__error" id="area-depth-error">{fieldErrors['depthCm']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="area-grid-x">Grid column</label>
          <input
            id="area-grid-x"
            className="input"
            type="number"
            required
            min={0}
            max={gridColumnsMax}
            step={1}
            value={values.gridX}
            onChange={(event) => change({ gridX: event.target.value })}
            aria-invalid={fieldErrors['gridX'] !== undefined}
            aria-describedby="area-grid-x-error" />
          <p className="field__error" id="area-grid-x-error">{fieldErrors['gridX']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="area-grid-y">Grid row</label>
          <input
            id="area-grid-y"
            className="input"
            type="number"
            required
            min={0}
            max={gridRowsMax}
            step={1}
            value={values.gridY}
            onChange={(event) => change({ gridY: event.target.value })}
            aria-invalid={fieldErrors['gridY'] !== undefined}
            aria-describedby="area-grid-y-error" />
          <p className="field__error" id="area-grid-y-error">{fieldErrors['gridY']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="area-notes">Notes</label>
          <textarea
            id="area-notes"
            className="textarea"
            maxLength={4000}
            value={values.notes}
            onChange={(event) => change({ notes: event.target.value })}
            aria-invalid={fieldErrors['notes'] !== undefined}
            aria-describedby="area-notes-error" />
          <p className="field__error" id="area-notes-error">{fieldErrors['notes']}</p>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
          disabled={save.isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
