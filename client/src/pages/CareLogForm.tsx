import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import { todayIsoDate } from '../api/date';
import {
  careKinds,
  careKeys,
  careLabel,
  createCareLog,
  updateCareLog,
  type CareKind,
  type CareLog,
  type CareLogInput,
} from '../api/careLogs';

export type CareLogFormTarget =
  | { mode: 'create'; plantingId: number }
  | { mode: 'edit'; careLog: CareLog };

type CareLogFormProps = {
  target: CareLogFormTarget;
  onClose: () => void;
};

/** Every control holds a string; the amount is converted on the way out. */
type FormValues = {
  kind: CareKind;
  performedOn: string;
  amount: string;
  note: string;
};

function initialValues(target: CareLogFormTarget): FormValues {
  if (target.mode === 'create') {
    return { kind: 'watered', performedOn: todayIsoDate(), amount: '', note: '' };
  }

  const careLog = target.careLog;
  return {
    kind: careLog.kind,
    performedOn: careLog.performedOn,
    amount: careLog.amount === null ? '' : String(careLog.amount),
    note: careLog.note ?? '',
  };
}

/** Blank means "not set"; the number input's own constraints keep the rest valid. */
function readAmount(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function CareLogForm({ target, onClose }: CareLogFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: CareLogInput) =>
      target.mode === 'create' ? createCareLog(target.plantingId, input) : updateCareLog(target.careLog.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careKeys.all });
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

    const input: CareLogInput = {
      kind: values.kind,
      performedOn: values.performedOn,
      amount: readAmount(values.amount),
      note: readText(values.note),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Add care log' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="care-form-heading">
      <h2 className="form-card__title" id="care-form-heading">
        {target.mode === 'create' ? 'Record care' : `Edit ${careLabel(target.careLog.kind).toLowerCase()}`}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="care-kind">Care type</label>
          <select
            id="care-kind"
            className="select"
            required
            autoFocus={target.mode === 'create'}
            value={values.kind}
            onChange={(event) => change({ kind: event.target.value as CareKind })}
            aria-invalid={fieldErrors['kind'] !== undefined}
            aria-describedby="care-kind-error">
            {careKinds.map((kind) => (
              <option key={kind} value={kind}>{careLabel(kind)}</option>
            ))}
          </select>
          <p className="field__error" id="care-kind-error">{fieldErrors['kind']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="care-performed-on">Date</label>
          <input
            id="care-performed-on"
            className="input"
            type="date"
            required
            value={values.performedOn}
            onChange={(event) => change({ performedOn: event.target.value })}
            aria-invalid={fieldErrors['performedOn'] !== undefined}
            aria-describedby="care-performed-on-error" />
          <p className="field__error" id="care-performed-on-error">{fieldErrors['performedOn']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="care-amount">Amount</label>
          <input
            id="care-amount"
            className="input"
            type="number"
            min={0}
            max={999999.99}
            step={0.01}
            value={values.amount}
            onChange={(event) => change({ amount: event.target.value })}
            aria-invalid={fieldErrors['amount'] !== undefined}
            aria-describedby="care-amount-hint care-amount-error" />
          <p className="field__hint" id="care-amount-hint">Optional, in whatever unit you count in.</p>
          <p className="field__error" id="care-amount-error">{fieldErrors['amount']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="care-note">Note</label>
          <textarea
            id="care-note"
            className="textarea"
            maxLength={4000}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
            aria-invalid={fieldErrors['note'] !== undefined}
            aria-describedby="care-note-error" />
          <p className="field__error" id="care-note-error">{fieldErrors['note']}</p>
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
