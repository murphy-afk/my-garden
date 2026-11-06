import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import {
  createSpecies,
  labelFor,
  speciesCategories,
  speciesCycles,
  speciesKeys,
  updateSpecies,
  type Species,
  type SpeciesCategory,
  type SpeciesCycle,
  type SpeciesInput,
} from '../api/species';

export type FormTarget = { mode: 'create' } | { mode: 'edit'; species: Species };

type SpeciesFormProps = {
  target: FormTarget;
  onClose: () => void;
};

/** Every control holds a string; counts are converted on the way out. */
type FormValues = {
  name: string;
  variety: string;
  category: SpeciesCategory;
  scientificName: string;
  cycle: SpeciesCycle;
  spacingCm: string;
  daysToFlower: string;
  daysToHarvest: string;
  notes: string;
};

function initialValues(target: FormTarget): FormValues {
  if (target.mode === 'create') {
    return {
      name: '',
      variety: '',
      category: 'vegetable',
      scientificName: '',
      cycle: 'annual',
      spacingCm: '',
      daysToFlower: '',
      daysToHarvest: '',
      notes: '',
    };
  }

  const species = target.species;
  return {
    name: species.name,
    variety: species.variety ?? '',
    category: species.category,
    scientificName: species.scientificName ?? '',
    cycle: species.cycle,
    spacingCm: species.spacingCm === null ? '' : String(species.spacingCm),
    daysToFlower: species.daysToFlower === null ? '' : String(species.daysToFlower),
    daysToHarvest: species.daysToHarvest === null ? '' : String(species.daysToHarvest),
    notes: species.notes ?? '',
  };
}

/** Blank means "not set"; the number input's own constraints keep the rest valid. */
function readCount(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function SpeciesForm({ target, onClose }: SpeciesFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: SpeciesInput) =>
      target.mode === 'create' ? createSpecies(input) : updateSpecies(target.species.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: speciesKeys.all });
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

    const input: SpeciesInput = {
      name: values.name.trim(),
      variety: readText(values.variety),
      category: values.category,
      scientificName: readText(values.scientificName),
      cycle: values.cycle,
      spacingCm: readCount(values.spacingCm),
      daysToFlower: readCount(values.daysToFlower),
      daysToHarvest: readCount(values.daysToHarvest),
      notes: readText(values.notes),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Create species' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="species-form-heading">
      <h2 className="form-card__title" id="species-form-heading">
        {target.mode === 'create' ? 'New species' : `Edit ${target.species.name}`}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="species-name">Name</label>
          <input
            id="species-name"
            className="input"
            type="text"
            required
            maxLength={120}
            autoFocus
            value={values.name}
            onChange={(event) => change({ name: event.target.value })}
            aria-invalid={fieldErrors['name'] !== undefined}
            aria-describedby="species-name-error" />
          <p className="field__error" id="species-name-error">{fieldErrors['name']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-variety">Variety</label>
          <input
            id="species-variety"
            className="input"
            type="text"
            maxLength={120}
            value={values.variety}
            onChange={(event) => change({ variety: event.target.value })}
            aria-invalid={fieldErrors['variety'] !== undefined}
            aria-describedby="species-variety-error" />
          <p className="field__error" id="species-variety-error">{fieldErrors['variety']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-category">Category</label>
          <select
            id="species-category"
            className="select"
            value={values.category}
            onChange={(event) => change({ category: event.target.value as SpeciesCategory })}
            aria-invalid={fieldErrors['category'] !== undefined}
            aria-describedby="species-category-error">
            {speciesCategories.map((category) => (
              <option key={category} value={category}>{labelFor(category)}</option>
            ))}
          </select>
          <p className="field__error" id="species-category-error">{fieldErrors['category']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-cycle">Life cycle</label>
          <select
            id="species-cycle"
            className="select"
            value={values.cycle}
            onChange={(event) => change({ cycle: event.target.value as SpeciesCycle })}
            aria-invalid={fieldErrors['cycle'] !== undefined}
            aria-describedby="species-cycle-error">
            {speciesCycles.map((cycle) => (
              <option key={cycle} value={cycle}>{labelFor(cycle)}</option>
            ))}
          </select>
          <p className="field__error" id="species-cycle-error">{fieldErrors['cycle']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-scientific-name">Scientific name</label>
          <input
            id="species-scientific-name"
            className="input"
            type="text"
            maxLength={160}
            value={values.scientificName}
            onChange={(event) => change({ scientificName: event.target.value })}
            aria-invalid={fieldErrors['scientificName'] !== undefined}
            aria-describedby="species-scientific-name-error" />
          <p className="field__error" id="species-scientific-name-error">{fieldErrors['scientificName']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-spacing">Spacing (cm)</label>
          <input
            id="species-spacing"
            className="input"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={values.spacingCm}
            onChange={(event) => change({ spacingCm: event.target.value })}
            aria-invalid={fieldErrors['spacingCm'] !== undefined}
            aria-describedby="species-spacing-error" />
          <p className="field__error" id="species-spacing-error">{fieldErrors['spacingCm']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-days-to-flower">Days to flower</label>
          <input
            id="species-days-to-flower"
            className="input"
            type="number"
            min={0}
            max={999}
            step={1}
            value={values.daysToFlower}
            onChange={(event) => change({ daysToFlower: event.target.value })}
            aria-invalid={fieldErrors['daysToFlower'] !== undefined}
            aria-describedby="species-days-to-flower-error" />
          <p className="field__error" id="species-days-to-flower-error">{fieldErrors['daysToFlower']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="species-days-to-harvest">Days to harvest</label>
          <input
            id="species-days-to-harvest"
            className="input"
            type="number"
            min={0}
            max={999}
            step={1}
            value={values.daysToHarvest}
            onChange={(event) => change({ daysToHarvest: event.target.value })}
            aria-invalid={fieldErrors['daysToHarvest'] !== undefined}
            aria-describedby="species-days-to-harvest-error" />
          <p className="field__error" id="species-days-to-harvest-error">{fieldErrors['daysToHarvest']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="species-notes">Notes</label>
          <textarea
            id="species-notes"
            className="textarea"
            maxLength={4000}
            value={values.notes}
            onChange={(event) => change({ notes: event.target.value })}
            aria-invalid={fieldErrors['notes'] !== undefined}
            aria-describedby="species-notes-error" />
          <p className="field__error" id="species-notes-error">{fieldErrors['notes']}</p>
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
