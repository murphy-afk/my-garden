import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import { todayIsoDate } from '../api/date';
import {
  createMilestone,
  milestoneKinds,
  milestoneKeys,
  milestoneLabel,
  updateMilestone,
  type Milestone,
  type MilestoneInput,
  type MilestoneKind,
} from '../api/milestones';

export type MilestoneFormTarget =
  | { mode: 'create'; plantingId: number }
  | { mode: 'edit'; milestone: Milestone };

type MilestoneFormProps = {
  target: MilestoneFormTarget;
  onClose: () => void;
};

/** Every control holds a string; the API takes the kind and date as they are. */
type FormValues = {
  kind: MilestoneKind;
  occurredOn: string;
  note: string;
};

function initialValues(target: MilestoneFormTarget): FormValues {
  if (target.mode === 'create') {
    return { kind: 'sown', occurredOn: todayIsoDate(), note: '' };
  }

  return {
    kind: target.milestone.kind,
    occurredOn: target.milestone.occurredOn,
    note: target.milestone.note ?? '',
  };
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function MilestoneForm({ target, onClose }: MilestoneFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: MilestoneInput) =>
      target.mode === 'create' ? createMilestone(target.plantingId, input) : updateMilestone(target.milestone.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milestoneKeys.all });
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

    const input: MilestoneInput = {
      kind: values.kind,
      occurredOn: values.occurredOn,
      note: readText(values.note),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Add milestone' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="milestone-form-heading">
      <h2 className="form-card__title" id="milestone-form-heading">
        {target.mode === 'create' ? 'Add a milestone' : `Edit ${milestoneLabel(target.milestone.kind)}`}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="milestone-kind">Milestone</label>
          <select
            id="milestone-kind"
            className="select"
            required
            autoFocus={target.mode === 'create'}
            value={values.kind}
            onChange={(event) => change({ kind: event.target.value as MilestoneKind })}
            aria-invalid={fieldErrors['kind'] !== undefined}
            aria-describedby="milestone-kind-error">
            {milestoneKinds.map((kind) => (
              <option key={kind} value={kind}>{milestoneLabel(kind)}</option>
            ))}
          </select>
          <p className="field__error" id="milestone-kind-error">{fieldErrors['kind']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="milestone-occurred-on">Date</label>
          <input
            id="milestone-occurred-on"
            className="input"
            type="date"
            required
            value={values.occurredOn}
            onChange={(event) => change({ occurredOn: event.target.value })}
            aria-invalid={fieldErrors['occurredOn'] !== undefined}
            aria-describedby="milestone-occurred-on-error" />
          <p className="field__error" id="milestone-occurred-on-error">{fieldErrors['occurredOn']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="milestone-note">Note</label>
          <textarea
            id="milestone-note"
            className="textarea"
            maxLength={4000}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
            aria-invalid={fieldErrors['note'] !== undefined}
            aria-describedby="milestone-note-error" />
          <p className="field__error" id="milestone-note-error">{fieldErrors['note']}</p>
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
