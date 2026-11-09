import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import { todayIsoDate } from '../api/date';
import {
  createHarvest,
  harvestKeys,
  harvestUnits,
  unitLabel,
  updateHarvest,
  type Harvest,
  type HarvestInput,
  type HarvestUnit,
} from '../api/harvests';

export type HarvestFormTarget =
  | { mode: 'create'; plantingId: number }
  | { mode: 'edit'; harvest: Harvest };

type HarvestFormProps = {
  target: HarvestFormTarget;
  onClose: () => void;
};

/** Every control holds a string; the quantity is converted on the way out. */
type FormValues = {
  harvestedOn: string;
  quantity: string;
  /** Blank until the gardener picks, since a courgette is counted differently from a carrot. */
  unit: HarvestUnit | '';
  note: string;
};

function initialValues(target: HarvestFormTarget): FormValues {
  if (target.mode === 'create') {
    return { harvestedOn: todayIsoDate(), quantity: '', unit: '', note: '' };
  }

  const harvest = target.harvest;
  return {
    harvestedOn: harvest.harvestedOn,
    quantity: String(harvest.quantity),
    unit: harvest.unit,
    note: harvest.note ?? '',
  };
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function HarvestForm({ target, onClose }: HarvestFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: HarvestInput) =>
      target.mode === 'create' ? createHarvest(target.plantingId, input) : updateHarvest(target.harvest.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: harvestKeys.all });
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

    // The unit select is required, so the browser stops an empty value
    // before this runs.
    if (values.unit === '') return;

    const input: HarvestInput = {
      harvestedOn: values.harvestedOn,
      quantity: Number(values.quantity),
      unit: values.unit,
      note: readText(values.note),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Add harvest' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="harvest-form-heading">
      <h2 className="form-card__title" id="harvest-form-heading">
        {target.mode === 'create' ? 'Record a harvest' : 'Edit harvest'}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="harvest-date">Harvested on</label>
          <input
            id="harvest-date"
            className="input"
            type="date"
            required
            value={values.harvestedOn}
            onChange={(event) => change({ harvestedOn: event.target.value })}
            aria-invalid={fieldErrors['harvestedOn'] !== undefined}
            aria-describedby="harvest-date-error" />
          <p className="field__error" id="harvest-date-error">{fieldErrors['harvestedOn']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="harvest-quantity">Quantity</label>
          <input
            id="harvest-quantity"
            className="input"
            type="number"
            min={0.01}
            max={99999999.99}
            step={0.01}
            required
            value={values.quantity}
            onChange={(event) => change({ quantity: event.target.value })}
            aria-invalid={fieldErrors['quantity'] !== undefined}
            aria-describedby="harvest-quantity-error" />
          <p className="field__error" id="harvest-quantity-error">{fieldErrors['quantity']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="harvest-unit">Unit</label>
          <select
            id="harvest-unit"
            className="select"
            required
            value={values.unit}
            onChange={(event) => change({ unit: event.target.value as HarvestUnit })}
            aria-invalid={fieldErrors['unit'] !== undefined}
            aria-describedby="harvest-unit-error">
            <option value="" disabled>Choose a unit</option>
            {harvestUnits.map((unit) => (
              <option key={unit} value={unit}>{unitLabel(unit)}</option>
            ))}
          </select>
          <p className="field__error" id="harvest-unit-error">{fieldErrors['unit']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="harvest-note">Note</label>
          <textarea
            id="harvest-note"
            className="textarea"
            maxLength={4000}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
            aria-invalid={fieldErrors['note'] !== undefined}
            aria-describedby="harvest-note-error" />
          <p className="field__error" id="harvest-note-error">{fieldErrors['note']}</p>
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
