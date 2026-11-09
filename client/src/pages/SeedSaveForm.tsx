import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import { todayIsoDate } from '../api/date';
import {
  createSeedSave,
  seedSaveKeys,
  seedStorages,
  storageLabel,
  updateSeedSave,
  type SeedSave,
  type SeedSaveInput,
  type SeedStorage,
} from '../api/seedSaves';

export type SeedSaveFormTarget =
  | { mode: 'create'; harvestId: number }
  | { mode: 'edit'; seedSave: SeedSave };

type SeedSaveFormProps = {
  target: SeedSaveFormTarget;
  onClose: () => void;
};

/** Every control holds a string; counts and flags are converted on the way out. */
type FormValues = {
  kept: boolean;
  quantity: string;
  storageMethod: SeedStorage | '';
  storageLocation: string;
  savedOn: string;
  note: string;
};

function initialValues(target: SeedSaveFormTarget): FormValues {
  if (target.mode === 'create') {
    return {
      kept: true,
      quantity: '',
      storageMethod: '',
      storageLocation: '',
      savedOn: todayIsoDate(),
      note: '',
    };
  }

  const seedSave = target.seedSave;
  return {
    kept: seedSave.kept,
    quantity: seedSave.quantity === null ? '' : String(seedSave.quantity),
    storageMethod: seedSave.storageMethod,
    storageLocation: seedSave.storageLocation ?? '',
    savedOn: seedSave.savedOn ?? todayIsoDate(),
    note: seedSave.note ?? '',
  };
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function SeedSaveForm({ target, onClose }: SeedSaveFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: SeedSaveInput) =>
      target.mode === 'create'
        ? createSeedSave(target.harvestId, input)
        : updateSeedSave(target.seedSave.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seedSaveKeys.all });
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

    // Nothing was kept, so the storage questions do not apply. The column
    // still needs a value, and 'other' is what the form would have shown.
    if (!values.kept) {
      save.mutate({
        kept: false,
        quantity: null,
        storageMethod: 'other',
        storageLocation: null,
        savedOn: null,
        note: readText(values.note),
      });
      return;
    }

    // The storage select is required, so the browser stops an empty value
    // before this runs.
    if (values.storageMethod === '') return;

    save.mutate({
      kept: true,
      quantity: values.quantity.trim() === '' ? null : Number(values.quantity),
      storageMethod: values.storageMethod,
      storageLocation: readText(values.storageLocation),
      savedOn: values.savedOn,
      note: readText(values.note),
    });
  }

  const submitLabel = target.mode === 'create' ? 'Save seed record' : 'Save changes';
  const heading = target.mode === 'create' ? 'Seeds from this harvest' : 'Edit seed record';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="seed-form-heading">
      <h2 className="form-card__title" id="seed-form-heading">{heading}</h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field field--full">
          <label className="checkbox" htmlFor="seed-kept">
            <input
              id="seed-kept"
              type="checkbox"
              checked={values.kept}
              onChange={(event) => change({ kept: event.target.checked })} />
            Seeds were kept from this harvest
          </label>
          <p className="field__hint" id="seed-kept-hint">
            Turn this off when nothing was saved, and the storage questions disappear.
          </p>
        </div>

        {values.kept && (
          <div className="field">
            <label className="field__label" htmlFor="seed-quantity">Quantity</label>
            <input
              id="seed-quantity"
              className="input"
              type="number"
              min={0.01}
              max={99999999.99}
              step={0.01}
              value={values.quantity}
              onChange={(event) => change({ quantity: event.target.value })}
              aria-invalid={fieldErrors['quantity'] !== undefined}
              aria-describedby="seed-quantity-hint seed-quantity-error" />
            <p className="field__hint" id="seed-quantity-hint">In seeds or grams, whatever you count in.</p>
            <p className="field__error" id="seed-quantity-error">{fieldErrors['quantity']}</p>
          </div>
        )}

        {values.kept && (
          <div className="field">
            <label className="field__label" htmlFor="seed-storage">Storage method</label>
            <select
              id="seed-storage"
              className="select"
              required
              value={values.storageMethod}
              onChange={(event) => change({ storageMethod: event.target.value as SeedStorage })}
              aria-invalid={fieldErrors['storageMethod'] !== undefined}
              aria-describedby="seed-storage-error">
              <option value="" disabled>Choose a method</option>
              {seedStorages.map((method) => (
                <option key={method} value={method}>{storageLabel(method)}</option>
              ))}
            </select>
            <p className="field__error" id="seed-storage-error">{fieldErrors['storageMethod']}</p>
          </div>
        )}

        {values.kept && (
          <div className="field">
            <label className="field__label" htmlFor="seed-location">Storage location</label>
            <input
              id="seed-location"
              className="input"
              type="text"
              maxLength={160}
              value={values.storageLocation}
              onChange={(event) => change({ storageLocation: event.target.value })}
              aria-invalid={fieldErrors['storageLocation'] !== undefined}
              aria-describedby="seed-location-hint seed-location-error" />
            <p className="field__hint" id="seed-location-hint">For example, shed shelf or kitchen drawer.</p>
            <p className="field__error" id="seed-location-error">{fieldErrors['storageLocation']}</p>
          </div>
        )}

        {values.kept && (
          <div className="field">
            <label className="field__label" htmlFor="seed-saved-on">Saved on</label>
            <input
              id="seed-saved-on"
              className="input"
              type="date"
              required
              value={values.savedOn}
              onChange={(event) => change({ savedOn: event.target.value })}
              aria-invalid={fieldErrors['savedOn'] !== undefined}
              aria-describedby="seed-saved-on-error" />
            <p className="field__error" id="seed-saved-on-error">{fieldErrors['savedOn']}</p>
          </div>
        )}

        <div className="field field--full">
          <label className="field__label" htmlFor="seed-note">Note</label>
          <textarea
            id="seed-note"
            className="textarea"
            maxLength={4000}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
            aria-invalid={fieldErrors['note'] !== undefined}
            aria-describedby="seed-note-error" />
          <p className="field__error" id="seed-note-error">{fieldErrors['note']}</p>
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
