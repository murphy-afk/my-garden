import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { messageFor, readFieldErrors } from '../api/client';
import { areaKeys, listAreas } from '../api/areas';
import { speciesKeys, listSpecies } from '../api/species';
import {
  createPlanting,
  labelFor,
  plantingKeys,
  plantingSources,
  plantingStatuses,
  todayIsoDate,
  updatePlanting,
  type Planting,
  type PlantingInput,
  type PlantingSource,
  type PlantingStatus,
} from '../api/plantings';

/**
 * A create starts from an optional area, so planting can begin from the
 * layout view with the bed already chosen.
 */
export type FormTarget = { mode: 'create'; areaId?: number | undefined } | { mode: 'edit'; planting: Planting };

type PlantingFormProps = {
  target: FormTarget;
  onClose: () => void;
};

/** Every control holds a string; counts and ids are converted on the way out. */
type FormValues = {
  speciesId: string;
  areaId: string;
  plantedOn: string;
  quantity: string;
  source: PlantingSource;
  status: PlantingStatus;
  endedOn: string;
  notes: string;
};

/** The starting values: today's date for a new planting, the stored record for an edit. */
function initialValues(target: FormTarget): FormValues {
  if (target.mode === 'create') {
    return {
      speciesId: '',
      areaId: target.areaId === undefined ? '' : String(target.areaId),
      plantedOn: todayIsoDate(),
      quantity: '1',
      source: 'seed',
      status: 'active',
      endedOn: '',
      notes: '',
    };
  }

  const planting = target.planting;
  return {
    speciesId: String(planting.species.id),
    areaId: String(planting.area.id),
    plantedOn: planting.plantedOn,
    quantity: String(planting.quantity),
    source: planting.source,
    status: planting.status,
    endedOn: planting.endedOn ?? '',
    notes: planting.notes ?? '',
  };
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function PlantingForm({ target, onClose }: PlantingFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  // Archived rows are offered while editing, so a planting whose species or
  // bed was archived later still shows what it holds.
  const includeArchived = target.mode === 'edit';
  const speciesQuery = useQuery({
    queryKey: [...speciesKeys.all, { includeArchived }],
    queryFn: () => listSpecies(includeArchived),
  });
  const areasQuery = useQuery({
    queryKey: [...areaKeys.all, { includeArchived }],
    queryFn: () => listAreas(includeArchived),
  });

  const speciesOptions = speciesQuery.data ?? [];
  const areaOptions = areasQuery.data ?? [];
  const optionsReady = !speciesQuery.isPending && !areasQuery.isPending;
  const optionsFailed = speciesQuery.isError || areasQuery.isError;

  const save = useMutation({
    mutationFn: (input: PlantingInput) =>
      target.mode === 'create' ? createPlanting(input) : updatePlanting(target.planting.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plantingKeys.all });
      onClose();
    },
  });

  const fieldErrors = readFieldErrors(save.error);
  const formError =
    save.error !== null && Object.keys(fieldErrors).length === 0 ? messageFor(save.error) : null;

  const missing: { message: string; to: string; action: string }[] = [];
  if (optionsReady && !optionsFailed && speciesOptions.length === 0) {
    missing.push({ message: 'There is nothing to plant yet.', to: '/species', action: 'Add a species' });
  }
  if (optionsReady && !optionsFailed && areaOptions.length === 0) {
    missing.push({ message: 'There is nowhere to plant yet.', to: '/garden', action: 'Add a garden area' });
  }
  const canSubmit = optionsReady && !optionsFailed && missing.length === 0;

  /** Replaces part of the form. Editing also drops the previous server answer. */
  function change(patch: Partial<FormValues>): void {
    setValues((current) => ({ ...current, ...patch }));
    if (save.isError) save.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;

    const input: PlantingInput = {
      speciesId: Number(values.speciesId),
      areaId: Number(values.areaId),
      plantedOn: values.plantedOn,
      quantity: Number(values.quantity),
      source: values.source,
      status: values.status,
      endedOn: values.status === 'ended' ? values.endedOn : null,
      notes: readText(values.notes),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Create planting' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="planting-form-heading">
      <h2 className="form-card__title" id="planting-form-heading">
        {target.mode === 'create' ? 'New planting' : `Edit ${target.planting.species.name}`}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}
      {optionsFailed && (
        <p className="alert" role="alert">
          The lists of species and areas could not be loaded, so nothing can be chosen here yet.
        </p>
      )}
      {missing.map((entry) => (
        <p className="alert" role="alert" key={entry.to}>
          {entry.message} <Link to={entry.to}>{entry.action}</Link>.
        </p>
      ))}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="planting-species">Species</label>
          <select
            id="planting-species"
            className="select"
            required
            autoFocus={target.mode === 'create'}
            disabled={!optionsReady}
            value={values.speciesId}
            onChange={(event) => change({ speciesId: event.target.value })}
            aria-invalid={fieldErrors['speciesId'] !== undefined}
            aria-describedby="planting-species-error">
            <option value="" disabled>
              {speciesQuery.isPending ? 'Loading species...' : 'Choose a species'}
            </option>
            {speciesOptions.map((species) => (
              <option key={species.id} value={species.id}>
                {species.variety === null ? species.name : `${species.name} (${species.variety})`}
                {species.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
          <p className="field__error" id="planting-species-error">{fieldErrors['speciesId']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="planting-area">Garden area</label>
          <select
            id="planting-area"
            className="select"
            required
            disabled={!optionsReady}
            value={values.areaId}
            onChange={(event) => change({ areaId: event.target.value })}
            aria-invalid={fieldErrors['areaId'] !== undefined}
            aria-describedby="planting-area-error">
            <option value="" disabled>
              {areasQuery.isPending ? 'Loading areas...' : 'Choose an area'}
            </option>
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
                {area.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
          <p className="field__error" id="planting-area-error">{fieldErrors['areaId']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="planting-planted-on">Planted on</label>
          <input
            id="planting-planted-on"
            className="input"
            type="date"
            required
            value={values.plantedOn}
            onChange={(event) => change({ plantedOn: event.target.value })}
            aria-invalid={fieldErrors['plantedOn'] !== undefined}
            aria-describedby="planting-planted-on-error" />
          <p className="field__error" id="planting-planted-on-error">{fieldErrors['plantedOn']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="planting-quantity">Quantity</label>
          <input
            id="planting-quantity"
            className="input"
            type="number"
            min={1}
            max={100000}
            step={1}
            required
            value={values.quantity}
            onChange={(event) => change({ quantity: event.target.value })}
            aria-invalid={fieldErrors['quantity'] !== undefined}
            aria-describedby="planting-quantity-error" />
          <p className="field__error" id="planting-quantity-error">{fieldErrors['quantity']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="planting-source">Source</label>
          <select
            id="planting-source"
            className="select"
            value={values.source}
            onChange={(event) => change({ source: event.target.value as PlantingSource })}
            aria-invalid={fieldErrors['source'] !== undefined}
            aria-describedby="planting-source-error">
            {plantingSources.map((source) => (
              <option key={source} value={source}>{labelFor(source)}</option>
            ))}
          </select>
          <p className="field__error" id="planting-source-error">{fieldErrors['source']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="planting-status">Status</label>
          <select
            id="planting-status"
            className="select"
            value={values.status}
            onChange={(event) => change({ status: event.target.value as PlantingStatus })}
            aria-invalid={fieldErrors['status'] !== undefined}
            aria-describedby="planting-status-error">
            {plantingStatuses.map((status) => (
              <option key={status} value={status}>{labelFor(status)}</option>
            ))}
          </select>
          <p className="field__error" id="planting-status-error">{fieldErrors['status']}</p>
        </div>

        {values.status === 'ended' && (
          <div className="field">
            <label className="field__label" htmlFor="planting-ended-on">Ended on</label>
            <input
              id="planting-ended-on"
              className="input"
              type="date"
              required
              value={values.endedOn}
              onChange={(event) => change({ endedOn: event.target.value })}
              aria-invalid={fieldErrors['endedOn'] !== undefined}
              aria-describedby="planting-ended-on-error" />
            <p className="field__error" id="planting-ended-on-error">{fieldErrors['endedOn']}</p>
          </div>
        )}

        <div className="field field--full">
          <label className="field__label" htmlFor="planting-notes">Notes</label>
          <textarea
            id="planting-notes"
            className="textarea"
            maxLength={4000}
            value={values.notes}
            onChange={(event) => change({ notes: event.target.value })}
            aria-invalid={fieldErrors['notes'] !== undefined}
            aria-describedby="planting-notes-error" />
          <p className="field__error" id="planting-notes-error">{fieldErrors['notes']}</p>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button" disabled={save.isPending || !canSubmit}>
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
