import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, LayoutGrid, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { messageFor } from '../api/client';
import {
  archiveArea,
  areaKeys,
  deleteArea,
  firstFreeSlot,
  kindLabel,
  listAreas,
  restoreArea,
  updateArea,
  type AreaGeometry,
  type GardenArea,
} from '../api/areas';
import { LayoutCanvas } from '../components/LayoutCanvas';
import { AreaForm, type FormTarget } from './AreaForm';
import '../styles/garden.css';

/** Size the create form starts with: a quarter of a slot, above the minimum. */
const defaultSize = { widthCm: 120, depthCm: 60 };

export function GardenPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  // Both variants are always loaded so the archived toggle can never hide the
  // list, and the empty state stays accurate when everything is archived.
  const query = useQuery({ queryKey: areaKeys.all, queryFn: () => listAreas(true) });

  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      archived ? archiveArea(id) : restoreArea(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: areaKeys.all });
      // Archiving with the filter off removes the row, which would drop focus to the body.
      if (!includeArchived && variables.archived) {
        addButtonRef.current?.focus();
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteArea(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: areaKeys.all });
      // The deleted row held focus, so move it to the header button.
      if (formTarget?.mode === 'edit' && formTarget.area.id === id) closeForm();
      else addButtonRef.current?.focus();
    },
  });

  const all = query.data ?? [];
  const active = all.filter((area) => !area.archived);
  const visible = includeArchived ? all : active;

  /**
   * Saving a drag: the canvas already shows the new geometry, so the cache is
   * updated first and rolled back if the API rejects it.
   */
  const saveGeometry = useMutation({
    mutationFn: ({ area, geometry }: { area: GardenArea; geometry: AreaGeometry }) =>
      updateArea(area.id, { ...area, ...geometry }),
    onMutate: async ({ area, geometry }) => {
      await queryClient.cancelQueries({ queryKey: areaKeys.all });
      const previous = queryClient.getQueryData<GardenArea[]>(areaKeys.all);
      queryClient.setQueryData<GardenArea[]>(areaKeys.all, (current) =>
        current === undefined ? current : current.map((item) => (item.id === area.id ? { ...item, ...geometry } : item)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(areaKeys.all, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: areaKeys.all }),
  });

  function handleSave(area: GardenArea, geometry: AreaGeometry): void {
    saveGeometry.mutate({ area, geometry });
  }

  function openCreate(event: MouseEvent<HTMLButtonElement>): void {
    triggerRef.current = event.currentTarget;
    const geometry = firstFreeSlot(active, defaultSize.widthCm, defaultSize.depthCm);
    setFormTarget({ mode: 'create', geometry });
  }

  function openEdit(area: GardenArea, trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'edit', area });
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
        <p className="state__text">Loading areas...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load areas</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (all.length === 0) {
    content = (
      <div className="state">
        <LayoutGrid className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">No areas yet</h2>
        <p className="state__text">Add the first area to start laying out the garden.</p>
        <button type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add area
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <div className="garden__layout">
          <p className="garden__hint">
            Drag an area to move it, drag its corner handle to resize it, or click it to edit. With an
            area focused, arrow keys move it and shift with arrow keys resizes it.
          </p>
          <LayoutCanvas areas={active} onSave={handleSave} onEdit={openEdit} />
        </div>

        <div className="garden__list">
          <div className="garden__toolbar">
            <label className="garden__toggle">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)} />
              Show archived
            </label>
            <p className="garden__count">{visible.length} {visible.length === 1 ? 'area' : 'areas'}</p>
          </div>

          {archive.isError && <p className="alert" role="alert">{messageFor(archive.error)}</p>}
          {remove.isError && <p className="alert" role="alert">{messageFor(remove.error)}</p>}

          {visible.length === 0 && (
            <div className="state">
              <h2 className="state__title">All areas are archived</h2>
              <p className="state__text">Turn on Show archived to see them again.</p>
            </div>
          )}

          {visible.length > 0 && (
            <div className="garden__table-wrap">
              <table className="garden__table">
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col">Type</th>
                    <th scope="col">Size</th>
                    <th scope="col">Position</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((area) => (
                    <tr key={area.id} className={area.archived ? 'garden__row garden__row--archived' : 'garden__row'}>
                      <td>
                        <div className="garden__identity">
                          <p className="garden__name-row">
                            <span className="garden__name">{area.name}</span>
                            {area.archived && <span className="garden__badge">Archived</span>}
                          </p>
                          {area.notes !== null && (
                            <p className="garden__notes" title={area.notes}>{area.notes}</p>
                          )}
                        </div>
                      </td>
                      <td>{kindLabel(area.kind)}</td>
                      <td>{area.widthCm} x {area.depthCm} cm</td>
                      <td>col {area.gridX}, row {area.gridY}</td>
                      <td>
                        <div className="garden__actions">
                          <button
                            type="button"
                            className="button button--quiet button--icon"
                            aria-label={`Edit ${area.name}`}
                            title="Edit"
                            onClick={(event) => openEdit(area, event.currentTarget)}>
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          {area.archived ? (
                            <button
                              type="button"
                              className="button button--quiet button--icon"
                              aria-label={`Restore ${area.name}`}
                              title="Restore"
                              onClick={() => archive.mutate({ id: area.id, archived: false })}>
                              <ArchiveRestore aria-hidden="true" size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button button--quiet button--icon"
                              aria-label={`Archive ${area.name}`}
                              title="Archive"
                              disabled={archive.isPending && archive.variables?.id === area.id}
                              onClick={() => archive.mutate({ id: area.id, archived: true })}>
                              <Archive aria-hidden="true" size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="button button--quiet button--icon"
                            aria-label={`Delete ${area.name}`}
                            title="Delete"
                            disabled={remove.isPending && remove.variables === area.id}
                            onClick={() => {
                              if (window.confirm(`Delete ${area.name}? This cannot be undone.`)) {
                                remove.mutate(area.id);
                              }
                            }}>
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <section className="garden" aria-labelledby="garden-heading">
      <header className="garden__header">
        <div>
          <h1 id="garden-heading">Garden</h1>
          <p className="garden__intro">
            Beds, pots and borders drawn on a grid, with the size and place of each area.
          </p>
        </div>
        <button ref={addButtonRef} type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add area
        </button>
      </header>

      {formTarget !== null && (
        <AreaForm
          key={formTarget.mode === 'edit' ? formTarget.area.id : 'create'}
          target={formTarget}
          onClose={closeForm} />
      )}

      {content}
    </section>
  );
}
