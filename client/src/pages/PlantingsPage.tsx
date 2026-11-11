import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { LoaderCircle, Pencil, Plus, RefreshCw, Sprout } from 'lucide-react';
import { messageFor } from '../api/client';
import { areaKeys, listAreas } from '../api/areas';
import { speciesKeys, listSpecies } from '../api/species';
import {
  labelFor,
  listPlantings,
  plantingKeys,
  plantingName,
  plantingStatuses,
  type Planting,
  type PlantingFilters,
  type PlantingStatus,
} from '../api/plantings';
import { PlantingForm, type FormTarget } from './PlantingForm';
import '../styles/plantings.css';

/** Reads a create opened from elsewhere, such as the layout view. */
function readCreateTarget(params: URLSearchParams): FormTarget | null {
  if (params.get('new') !== '1') return null;
  const rawAreaId = Number(params.get('areaId'));
  const areaId = Number.isInteger(rawAreaId) && rawAreaId >= 1 ? rawAreaId : undefined;
  return { mode: 'create', areaId };
}

export function PlantingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(() => readCreateTarget(searchParams));
  const [areaFilter, setAreaFilter] = useState<number | ''>('');
  const [speciesFilter, setSpeciesFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<PlantingStatus | ''>('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const filters: PlantingFilters = {
    areaId: areaFilter === '' ? undefined : areaFilter,
    speciesId: speciesFilter === '' ? undefined : speciesFilter,
    status: statusFilter === '' ? undefined : statusFilter,
  };
  const hasFilters = areaFilter !== '' || speciesFilter !== '' || statusFilter !== '';

  const query = useQuery({
    queryKey: [...plantingKeys.all, 'list', filters],
    queryFn: () => listPlantings(filters),
  });

  // The two filter menus only need the active rows; the form asks for more.
  const areasQuery = useQuery({ queryKey: areaKeys.all, queryFn: () => listAreas(false) });
  const speciesQuery = useQuery({ queryKey: speciesKeys.all, queryFn: () => listSpecies(false) });

  const areas = areasQuery.data ?? [];
  const species = speciesQuery.data ?? [];
  const all = query.data ?? [];

  function openCreate(event: MouseEvent<HTMLButtonElement>): void {
    triggerRef.current = event.currentTarget;
    setFormTarget({ mode: 'create' });
  }

  function openEdit(planting: Planting, trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'edit', planting });
  }

  function closeForm(): void {
    setFormTarget(null);
    // Drop the address that opened the form, so coming back to this page does
    // not open it again.
    if (searchParams.get('new') === '1') setSearchParams({}, { replace: true });
    // The trigger may have left the list (an empty state collapsing away), so
    // fall back to the header button, which is always there.
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addButtonRef.current?.focus();
  }

  function clearFilters(): void {
    setAreaFilter('');
    setSpeciesFilter('');
    setStatusFilter('');
  }

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading plantings...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load plantings</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (all.length === 0 && !hasFilters) {
    content = (
      <div className="state">
        <Sprout className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">No plantings yet</h2>
        <p className="state__text">Plant a species into an area and the record of it starts here.</p>
        <button type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add planting
        </button>
      </div>
    );
  } else if (all.length === 0) {
    content = (
      <div className="state">
        <h2 className="state__title">No plantings match these filters</h2>
        <p className="state__text">Widen the filters to see the rest.</p>
        <button type="button" className="button button--secondary" onClick={clearFilters}>
          <RefreshCw aria-hidden="true" size={16} /> Clear filters
        </button>
      </div>
    );
  } else {
    content = (
      <div className="plantings__table-wrap">
        <table className="plantings__table">
          <thead>
            <tr>
              <th scope="col">Planting</th>
              <th scope="col">Area</th>
              <th scope="col">Planted</th>
              <th scope="col">Quantity</th>
              <th scope="col">Source</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {all.map((planting) => (
              <tr key={planting.id} className="plantings__row">
                <td>
                  <div className="plantings__identity">
                    <Link className="plantings__name" to={`/plantings/${planting.id}`}>
                      {plantingName(planting)}
                    </Link>
                    {planting.notes !== null && (
                      <p className="plantings__notes" title={planting.notes}>{planting.notes}</p>
                    )}
                  </div>
                </td>
                <td>{planting.area.name}</td>
                <td>{planting.plantedOn}</td>
                <td>{planting.quantity}</td>
                <td>{labelFor(planting.source)}</td>
                <td>
                  <span className={`planting__badge planting__badge--${planting.status}`}>
                    {labelFor(planting.status)}
                  </span>
                  {planting.endedOn !== null && <span className="plantings__ended">on {planting.endedOn}</span>}
                </td>
                <td>
                  <div className="plantings__actions">
                    <button
                      type="button"
                      className="button button--quiet button--icon"
                      aria-label={`Edit ${plantingName(planting)}`}
                      title="Edit"
                      onClick={(event) => openEdit(planting, event.currentTarget)}>
                      <Pencil aria-hidden="true" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="plantings" aria-labelledby="plantings-heading">
      <header className="plantings__header">
        <div>
          <h1 id="plantings-heading">Plantings</h1>
          <p className="plantings__intro">
            What was planted, where and when, with the record kept for each planting.
          </p>
        </div>
        <button ref={addButtonRef} type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add planting
        </button>
      </header>

      {formTarget !== null && (
        <PlantingForm
          key={formTarget.mode === 'edit' ? formTarget.planting.id : 'create'}
          target={formTarget}
          onClose={closeForm} />
      )}

      {(areasQuery.isError || speciesQuery.isError) && (
        <p className="alert" role="alert">
          The filter menus could not be loaded: {messageFor(areasQuery.error ?? speciesQuery.error)}
        </p>
      )}

      {(hasFilters || all.length > 0) && (
        <div className="plantings__filters">
          <div className="field plantings__filter">
            <label className="field__label" htmlFor="plantings-filter-area">Area</label>
            <select
              id="plantings-filter-area"
              className="select"
              value={areaFilter === '' ? '' : String(areaFilter)}
              onChange={(event) => setAreaFilter(event.target.value === '' ? '' : Number(event.target.value))}>
              <option value="">All areas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </div>

          <div className="field plantings__filter">
            <label className="field__label" htmlFor="plantings-filter-species">Species</label>
            <select
              id="plantings-filter-species"
              className="select"
              value={speciesFilter === '' ? '' : String(speciesFilter)}
              onChange={(event) => setSpeciesFilter(event.target.value === '' ? '' : Number(event.target.value))}>
              <option value="">All species</option>
              {species.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.variety === null ? item.name : `${item.name} (${item.variety})`}
                </option>
              ))}
            </select>
          </div>

          <div className="field plantings__filter">
            <label className="field__label" htmlFor="plantings-filter-status">Status</label>
            <select
              id="plantings-filter-status"
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PlantingStatus | '')}>
              <option value="">All statuses</option>
              {plantingStatuses.map((status) => (
                <option key={status} value={status}>{labelFor(status)}</option>
              ))}
            </select>
          </div>

          <p className="plantings__count">
            {all.length} {all.length === 1 ? 'planting' : 'plantings'}
          </p>
        </div>
      )}

      {content}
    </section>
  );
}
