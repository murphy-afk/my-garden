import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { LoaderCircle, Package, RefreshCw } from 'lucide-react';
import { messageFor } from '../api/client';
import { listSeedSaves, seedSaveKeys, storageLabel } from '../api/seedSaves';
import '../styles/seeds.css';

/**
 * The seed inventory: every record where seeds were kept, newest first.
 * Records where nothing was kept belong to their harvest, so they are not
 * part of what is in the drawer.
 */
export function SeedsPage() {
  const query = useQuery({
    queryKey: [...seedSaveKeys.all, 'inventory'],
    queryFn: () => listSeedSaves({ kept: true }),
  });

  const seedSaves = query.data ?? [];

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading the seed inventory...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load the seed inventory</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (seedSaves.length === 0) {
    content = (
      <div className="state">
        <Package className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">No seeds kept yet</h2>
        <p className="state__text">
          Seeds are kept from a harvest, so record a harvest and say the seeds were kept.
        </p>
        <Link className="button" to="/plantings">
          Go to plantings
        </Link>
      </div>
    );
  } else {
    content = (
      <ul className="seeds__list">
        {seedSaves.map((seedSave) => (
          <li className="seeds__entry" key={seedSave.id}>
            <div className="seeds__entry-main">
              <p className="seeds__line">
                <Link className="seeds__species" to={`/plantings/${seedSave.planting.id}`}>
                  {seedSave.planting.species.variety === null
                    ? seedSave.planting.species.name
                    : `${seedSave.planting.species.name} ${seedSave.planting.species.variety}`}
                </Link>
                {seedSave.quantity !== null && (
                  <span className="seeds__quantity">{seedSave.quantity}</span>
                )}
                <span className="seeds__storage">{storageLabel(seedSave.storageMethod)}</span>
              </p>
              <p className="seeds__meta">
                {seedSave.savedOn !== null
                  ? `Saved ${seedSave.savedOn}`
                  : `From the harvest on ${seedSave.harvestedOn}`}
                {seedSave.storageLocation !== null && `, kept in ${seedSave.storageLocation}`}
              </p>
              {seedSave.note !== null && <p className="seeds__note">{seedSave.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="seeds" aria-labelledby="seeds-heading">
      <header className="seeds__header">
        <div>
          <h1 id="seeds-heading">Seeds</h1>
          <p className="seeds__intro">
            What was kept after the harvest, with where it is stored.
          </p>
        </div>
      </header>

      {seedSaves.length > 0 && (
        <p className="seeds__count">
          {seedSaves.length} {seedSaves.length === 1 ? 'seed record' : 'seed records'}
        </p>
      )}

      {content}
    </section>
  );
}
