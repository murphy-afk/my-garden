import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { LoaderCircle, RefreshCw, Wheat } from 'lucide-react';
import { messageFor } from '../api/client';
import { areaKeys, listAreas } from '../api/areas';
import { harvestKeys, listHarvests, unitLabel } from '../api/harvests';
import '../styles/harvests.css';

/**
 * Everything picked across the garden, newest first. Editing happens on the
 * planting the harvest belongs to, so this list links there instead of
 * carrying its own forms.
 */
export function HarvestsPage() {
  const [areaFilter, setAreaFilter] = useState<number | ''>('');

  const areasQuery = useQuery({ queryKey: areaKeys.all, queryFn: () => listAreas(false) });
  const query = useQuery({
    queryKey: [...harvestKeys.all, 'list', { areaFilter }],
    queryFn: () => listHarvests(areaFilter === '' ? {} : { areaId: areaFilter }),
  });

  const areas = areasQuery.data ?? [];
  const harvests = query.data ?? [];
  const hasFilters = areaFilter !== '';

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading harvests...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load harvests</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (harvests.length === 0 && !hasFilters) {
    content = (
      <div className="state">
        <Wheat className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">Nothing harvested yet</h2>
        <p className="state__text">
          Harvests are recorded from the page of the planting they came from, so open a planting first.
        </p>
        <Link className="button" to="/plantings">
          Go to plantings
        </Link>
      </div>
    );
  } else if (harvests.length === 0) {
    content = (
      <div className="state">
        <h2 className="state__title">No harvests in this area</h2>
        <p className="state__text">Choose another area to see the rest.</p>
        <button type="button" className="button button--secondary" onClick={() => setAreaFilter('')}>
          <RefreshCw aria-hidden="true" size={16} /> Show all areas
        </button>
      </div>
    );
  } else {
    content = (
      <ul className="harvest__list">
        {harvests.map((harvest) => (
          <li className="harvest__entry" key={harvest.id}>
            <div className="harvest__entry-main">
              <p className="harvest__line">
                <span className="harvest__date">
                  <time dateTime={harvest.harvestedOn}>{harvest.harvestedOn}</time>
                </span>
                <span className="harvest__quantity">
                  {harvest.quantity} {unitLabel(harvest.unit)}
                </span>
              </p>
              <p className="harvest__planting">
                <Link to={`/plantings/${harvest.planting.id}`}>
                  {harvest.planting.species.variety === null
                    ? harvest.planting.species.name
                    : `${harvest.planting.species.name} ${harvest.planting.species.variety}`}
                  {' in '}
                  {harvest.planting.area.name}
                </Link>
              </p>
              {harvest.note !== null && <p className="harvest__note">{harvest.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="harvests" aria-labelledby="harvests-heading">
      <header className="harvests__header">
        <div>
          <h1 id="harvests-heading">Harvests</h1>
          <p className="harvests__intro">What was picked, how much and when, newest first.</p>
        </div>
      </header>

      {areasQuery.isError && (
        <p className="alert" role="alert">
          The area filter could not be loaded: {messageFor(areasQuery.error)}
        </p>
      )}

      {(hasFilters || harvests.length > 0) && (
        <div className="harvests__filters">
          <div className="field harvests__filter">
            <label className="field__label" htmlFor="harvests-filter-area">Area</label>
            <select
              id="harvests-filter-area"
              className="select"
              value={areaFilter === '' ? '' : String(areaFilter)}
              onChange={(event) => setAreaFilter(event.target.value === '' ? '' : Number(event.target.value))}>
              <option value="">All areas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </div>

          <p className="harvests__count">
            {harvests.length} {harvests.length === 1 ? 'harvest' : 'harvests'}
          </p>
        </div>
      )}

      {content}
    </section>
  );
}
