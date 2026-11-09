import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Package, Pencil, Plus, RefreshCw, Trash2, Wheat } from 'lucide-react';
import { messageFor } from '../api/client';
import { deleteHarvest, harvestKeys, listHarvests, unitLabel } from '../api/harvests';
import { deleteSeedSave, listSeedSaves, seedSaveKeys, storageLabel, type SeedSave } from '../api/seedSaves';
import { HarvestForm, type HarvestFormTarget } from '../pages/HarvestForm';
import { SeedSaveForm, type SeedSaveFormTarget } from '../pages/SeedSaveForm';

type PlantingHarvestsProps = {
  plantingId: number;
};

/** One line for the seed record under a harvest, in the words a gardener uses. */
function seedLine(seedSave: SeedSave): string {
  if (!seedSave.kept) return 'Seeds not kept';

  const parts = ['Seeds kept'];
  if (seedSave.quantity !== null) parts.push(`: ${seedSave.quantity}`);
  parts.push(` in ${storageLabel(seedSave.storageMethod).toLowerCase()}`);
  if (seedSave.storageLocation !== null) parts.push(`, ${seedSave.storageLocation}`);
  if (seedSave.savedOn !== null) parts.push(`, ${seedSave.savedOn}`);
  return parts.join('');
}

/**
 * The harvest half of a planting: what was picked, and the seed record
 * linked to each pick. It owns its own data, so the detail page only has to
 * place it.
 */
export function PlantingHarvests({ plantingId }: PlantingHarvestsProps) {
  const [harvestForm, setHarvestForm] = useState<HarvestFormTarget | null>(null);
  const [seedForm, setSeedForm] = useState<SeedSaveFormTarget | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const harvestsQuery = useQuery({
    queryKey: harvestKeys.forPlanting(plantingId),
    queryFn: () => listHarvests({ plantingId }),
  });
  const seedSavesQuery = useQuery({
    queryKey: seedSaveKeys.forPlanting(plantingId),
    queryFn: () => listSeedSaves({ plantingId }),
  });

  const removeHarvest = useMutation({
    mutationFn: (harvestId: number) => deleteHarvest(harvestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: harvestKeys.all });
      queryClient.invalidateQueries({ queryKey: seedSaveKeys.all });
      // The row that held focus is about to disappear, so focus moves to the
      // button that adds the next harvest.
      addRef.current?.focus();
    },
  });

  const removeSeedSave = useMutation({
    mutationFn: (seedSaveId: number) => deleteSeedSave(seedSaveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seedSaveKeys.all });
      addRef.current?.focus();
    },
  });

  function rememberTrigger(trigger: HTMLElement): void {
    triggerRef.current = trigger;
  }

  function closeHarvestForm(): void {
    setHarvestForm(null);
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addRef.current?.focus();
  }

  function closeSeedForm(): void {
    setSeedForm(null);
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addRef.current?.focus();
  }

  const harvests = harvestsQuery.data ?? [];
  const seedSaves = seedSavesQuery.data ?? [];
  const seedByHarvest = new Map<number, SeedSave>(seedSaves.map((seedSave) => [seedSave.harvestId, seedSave]));

  let content: ReactNode;
  if (harvestsQuery.isPending || seedSavesQuery.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading harvests...</p>
      </div>
    );
  } else if (harvestsQuery.isError || seedSavesQuery.isError) {
    const error = harvestsQuery.isError ? harvestsQuery.error : seedSavesQuery.error;
    content = (
      <div className="state state--error" role="alert">
        <h3 className="state__title">Could not load harvests</h3>
        <p className="state__text">{messageFor(error)}</p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            harvestsQuery.refetch();
            seedSavesQuery.refetch();
          }}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (harvests.length === 0) {
    content = (
      <div className="state">
        <Wheat className="state__icon" aria-hidden="true" size={32} />
        <h3 className="state__title">Nothing harvested yet</h3>
        <p className="state__text">
          Record what was picked, then keep a seed record against the pick when seeds are saved.
        </p>
      </div>
    );
  } else {
    content = (
      <ul className="harvest__list">
        {harvests.map((harvest) => {
          const seedSave = seedByHarvest.get(harvest.id);

          return (
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

                {harvest.note !== null && <p className="harvest__note">{harvest.note}</p>}

                <div className="harvest__seed">
                  <p className="harvest__seed-line">
                    <Package aria-hidden="true" size={14} />
                    {seedSave === undefined ? 'No seed record yet' : seedLine(seedSave)}
                  </p>
                  {seedSave !== undefined && seedSave.note !== null && (
                    <p className="harvest__seed-note">{seedSave.note}</p>
                  )}
                  {seedSave === undefined && (
                    <button
                      type="button"
                      className="button button--quiet harvest__seed-add"
                      onClick={(event) => {
                        rememberTrigger(event.currentTarget);
                        setSeedForm({ mode: 'create', harvestId: harvest.id });
                      }}>
                      <Plus aria-hidden="true" size={14} /> Add seed save
                    </button>
                  )}
                  {seedSave !== undefined && (
                    <div className="harvest__seed-actions">
                      <button
                        type="button"
                        className="button button--quiet button--icon"
                        aria-label={`Edit the seed record for the harvest on ${harvest.harvestedOn}`}
                        title="Edit seed save"
                        onClick={(event) => {
                          rememberTrigger(event.currentTarget);
                          setSeedForm({ mode: 'edit', seedSave });
                        }}>
                        <Pencil aria-hidden="true" size={16} />
                      </button>
                      <button
                        type="button"
                        className="button button--quiet button--icon"
                        aria-label={`Delete the seed record for the harvest on ${harvest.harvestedOn}`}
                        title="Delete seed save"
                        disabled={removeSeedSave.isPending && removeSeedSave.variables === seedSave.id}
                        onClick={() => {
                          if (window.confirm('Delete this seed record? This cannot be undone.')) {
                            removeSeedSave.mutate(seedSave.id);
                          }
                        }}>
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="harvest__actions">
                <button
                  type="button"
                  className="button button--quiet button--icon"
                  aria-label={`Edit the harvest on ${harvest.harvestedOn}`}
                  title="Edit"
                  onClick={(event) => {
                    rememberTrigger(event.currentTarget);
                    setHarvestForm({ mode: 'edit', harvest });
                  }}>
                  <Pencil aria-hidden="true" size={16} />
                </button>
                <button
                  type="button"
                  className="button button--quiet button--icon"
                  aria-label={`Delete the harvest on ${harvest.harvestedOn}`}
                  title="Delete"
                  disabled={removeHarvest.isPending && removeHarvest.variables === harvest.id}
                  onClick={() => {
                    const message =
                      seedSave === undefined
                        ? 'Delete this harvest? This cannot be undone.'
                        : 'Delete this harvest? Its seed record goes with it. This cannot be undone.';
                    if (window.confirm(message)) {
                      removeHarvest.mutate(harvest.id);
                    }
                  }}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="planting__section" aria-labelledby="planting-harvest-heading">
      <div className="planting__section-head">
        <h2 id="planting-harvest-heading">Harvest</h2>
        <button
          ref={addRef}
          type="button"
          className="button button--secondary"
          onClick={(event) => {
            rememberTrigger(event.currentTarget);
            setHarvestForm({ mode: 'create', plantingId });
          }}>
          <Plus aria-hidden="true" size={16} /> Add harvest
        </button>
      </div>

      {harvestForm !== null && <HarvestForm target={harvestForm} onClose={closeHarvestForm} />}
      {seedForm !== null && <SeedSaveForm target={seedForm} onClose={closeSeedForm} />}

      {removeHarvest.isError && <p className="alert" role="alert">{messageFor(removeHarvest.error)}</p>}
      {removeSeedSave.isError && <p className="alert" role="alert">{messageFor(removeSeedSave.error)}</p>}

      {content}
    </section>
  );
}
