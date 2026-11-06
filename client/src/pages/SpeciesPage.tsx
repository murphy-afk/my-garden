import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Flower2, LoaderCircle, Pencil, Plus, RefreshCw } from 'lucide-react';
import { messageFor } from '../api/client';
import {
  archiveSpecies,
  labelFor,
  listSpecies,
  restoreSpecies,
  speciesKeys,
  type Species,
} from '../api/species';
import { SpeciesForm, type FormTarget } from './SpeciesForm';
import '../styles/species.css';

/** The seed uses 0 for "not tracked", so only positive values are shown. */
function formatDays(value: number | null): string {
  return value !== null && value > 0 ? `${value} days` : '';
}

function formatCm(value: number | null): string {
  return value === null ? '' : `${value} cm`;
}

export function SpeciesPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...speciesKeys.all, { includeArchived }],
    queryFn: () => listSpecies(includeArchived),
  });

  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      archived ? archiveSpecies(id) : restoreSpecies(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: speciesKeys.all });
      // Archiving with the filter off removes the row, which would drop focus to the body.
      if (!includeArchived && variables.archived) {
        addButtonRef.current?.focus();
      }
    },
  });

  const all = query.data ?? [];
  const visible = includeArchived ? all : all.filter((item) => !item.archived);

  function openCreate(event: MouseEvent<HTMLButtonElement>): void {
    triggerRef.current = event.currentTarget;
    setFormTarget({ mode: 'create' });
  }

  function openEdit(species: Species, event: MouseEvent<HTMLButtonElement>): void {
    triggerRef.current = event.currentTarget;
    setFormTarget({ mode: 'edit', species });
  }

  function closeForm(): void {
    setFormTarget(null);
    // The trigger may have left the list (an empty state collapsing away), so
    // fall back to the header button, which is always there.
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addButtonRef.current?.focus();
  }

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading species...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load species</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (all.length === 0) {
    content = (
      <div className="state">
        <Flower2 className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">No species yet</h2>
        <p className="state__text">Add the first species to start planting.</p>
        <button type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add species
        </button>
      </div>
    );
  } else {
    content = (
      <div className="species__list">
        <div className="species__toolbar">
          <label className="species__toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)} />
            Show archived
          </label>
          <p className="species__count">{visible.length} species</p>
        </div>

        {archive.isError && <p className="alert" role="alert">{messageFor(archive.error)}</p>}

        {visible.length === 0 && (
          <div className="state">
            <h2 className="state__title">All species are archived</h2>
            <p className="state__text">Turn on Show archived to see them again.</p>
          </div>
        )}

        {visible.length > 0 && (
          <div className="species__table-wrap">
            <table className="species__table">
              <thead>
                <tr>
                  <th scope="col">Species</th>
                  <th scope="col">Category</th>
                  <th scope="col">Cycle</th>
                  <th scope="col">Spacing</th>
                  <th scope="col">Days to harvest</th>
                  <th scope="col">Notes</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    className={item.archived ? 'species__row species__row--archived' : 'species__row'}>
                    <td>
                      <div className="species__identity">
                        <p className="species__name-row">
                          <span className="species__name">{item.name}</span>
                          {item.variety !== null && <span className="species__variety">{item.variety}</span>}
                          {item.archived && <span className="badge badge--archived">Archived</span>}
                        </p>
                        {item.scientificName !== null && (
                          <p className="species__scientific">{item.scientificName}</p>
                        )}
                        {item.notes !== null && (
                          <p className="species__notes" title={item.notes}>{item.notes}</p>
                        )}
                      </div>
                    </td>
                    <td>{labelFor(item.category)}</td>
                    <td>{labelFor(item.cycle)}</td>
                    <td>{formatCm(item.spacingCm)}</td>
                    <td>{formatDays(item.daysToHarvest)}</td>
                    <td>
                      <div className="species__actions">
                        <button
                          type="button"
                          className="button button--quiet button--icon"
                          aria-label={`Edit ${item.name}`}
                          title="Edit"
                          onClick={(event) => openEdit(item, event)}>
                          <Pencil aria-hidden="true" size={16} />
                        </button>
                        {item.archived ? (
                          <button
                            type="button"
                            className="button button--quiet button--icon"
                            aria-label={`Restore ${item.name}`}
                            title="Restore"
                            onClick={() => archive.mutate({ id: item.id, archived: false })}>
                            <ArchiveRestore aria-hidden="true" size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button--quiet button--icon"
                            aria-label={`Archive ${item.name}`}
                            title="Archive"
                            disabled={archive.isPending && archive.variables?.id === item.id}
                            onClick={() => archive.mutate({ id: item.id, archived: true })}>
                            <Archive aria-hidden="true" size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="species" aria-labelledby="species-heading">
      <header className="species__header">
        <div>
          <h1 id="species-heading">Species</h1>
          <p className="species__intro">Everything that can be planted, with the growing details for each.</p>
        </div>
        <button ref={addButtonRef} type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add species
        </button>
      </header>

      {formTarget !== null && (
        <SpeciesForm
          key={formTarget.mode === 'edit' ? formTarget.species.id : 'create'}
          target={formTarget}
          onClose={closeForm} />
      )}

      {content}
    </section>
  );
}
