import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Link2, LoaderCircle, Pencil, Plus, RefreshCw, Scissors, Trash2 } from 'lucide-react';
import { messageFor } from '../api/client';
import { todayIsoDate } from '../api/date';
import {
  careKeys,
  careLabel,
  createCareLog,
  deleteCareLog,
  listCareLogs,
  summarizeCare,
  type CareKind,
  type CareLog,
} from '../api/careLogs';
import { CareLogForm, type CareLogFormTarget } from '../pages/CareLogForm';

type PlantingCareProps = {
  plantingId: number;
};

/** The quick add buttons, in the order the brief asks its questions. */
const quickKinds: readonly CareKind[] = ['watered', 'pruned', 'tied', 'fed'];

/**
 * The care half of a planting: the summary line, one click to record today's
 * care, and the log itself. It owns its own data, so the detail page only has
 * to place it.
 */
export function PlantingCare({ plantingId }: PlantingCareProps) {
  const [formTarget, setFormTarget] = useState<CareLogFormTarget | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: careKeys.forPlanting(plantingId),
    queryFn: () => listCareLogs(plantingId),
  });

  const logs = query.data ?? [];
  const summary = summarizeCare(logs);

  /** A quick add is one click: the care type, today's date and nothing else. */
  const quickAdd = useMutation({
    mutationFn: (kind: CareKind) =>
      createCareLog(plantingId, { kind, performedOn: todayIsoDate(), amount: null, note: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: careKeys.forPlanting(plantingId) }),
  });

  const remove = useMutation({
    mutationFn: (careLogId: number) => deleteCareLog(careLogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careKeys.all });
      // The row that held focus is about to disappear, so focus moves to the
      // button that adds the next log.
      addRef.current?.focus();
    },
  });

  function openCreate(trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'create', plantingId });
  }

  function openEdit(careLog: CareLog, trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'edit', careLog });
  }

  function closeForm(): void {
    setFormTarget(null);
    // The trigger may have left the list (an empty state collapsing away), so
    // fall back to the section button, which is always there.
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addRef.current?.focus();
  }

  let listContent: ReactNode;
  if (query.isPending) {
    listContent = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading care...</p>
      </div>
    );
  } else if (query.isError) {
    listContent = (
      <div className="state state--error" role="alert">
        <h3 className="state__title">Could not load the care log</h3>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (logs.length === 0) {
    listContent = (
      <div className="state">
        <Droplets className="state__icon" aria-hidden="true" size={32} />
        <h3 className="state__title">No care recorded yet</h3>
        <p className="state__text">
          Use the quick buttons to note today's care, or add a log with an amount and a note.
        </p>
      </div>
    );
  } else {
    listContent = (
      <ul className="care__list">
        {logs.map((careLog) => (
          <li className="care__entry" key={careLog.id}>
            <div className="care__entry-main">
              <p className="care__entry-line">
                <span className="care__kind">{careLabel(careLog.kind)}</span>
                <span className="care__date">
                  <time dateTime={careLog.performedOn}>{careLog.performedOn}</time>
                </span>
                {careLog.amount !== null && <span className="care__amount">{careLog.amount}</span>}
              </p>
              {careLog.note !== null && <p className="care__note">{careLog.note}</p>}
            </div>
            <div className="care__actions">
              <button
                type="button"
                className="button button--quiet button--icon"
                aria-label={`Edit ${careLog.kind} log from ${careLog.performedOn}`}
                title="Edit"
                onClick={(event) => openEdit(careLog, event.currentTarget)}>
                <Pencil aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className="button button--quiet button--icon"
                aria-label={`Delete ${careLog.kind} log from ${careLog.performedOn}`}
                title="Delete"
                disabled={remove.isPending && remove.variables === careLog.id}
                onClick={() => {
                  if (window.confirm('Delete this care log? This cannot be undone.')) {
                    remove.mutate(careLog.id);
                  }
                }}>
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="planting__section" aria-labelledby="planting-care-heading">
      <div className="planting__section-head">
        <h2 id="planting-care-heading">Care</h2>
        <button
          ref={addRef}
          type="button"
          className="button button--secondary"
          onClick={(event) => openCreate(event.currentTarget)}>
          <Plus aria-hidden="true" size={16} /> Add care log
        </button>
      </div>

      {/* Spoken when a quick add lands, so the new answer is announced. */}
      {query.isSuccess && (
        <div className="care__summary" aria-live="polite">
          <span className="care__summary-item">
            <Droplets aria-hidden="true" size={16} />
            {summary.lastWatered === null ? 'Not watered yet' : `Last watered ${summary.lastWatered}`}
          </span>
          <span className="care__summary-item">
            <Scissors aria-hidden="true" size={16} />
            {summary.lastPruned === null ? 'Not pruned yet' : `Last pruned ${summary.lastPruned}`}
          </span>
          <span className="care__summary-item">
            <Link2 aria-hidden="true" size={16} />
            {summary.tied ? 'Tied up' : 'Not tied'}
          </span>
        </div>
      )}

      <div className="care__quick">
        {quickKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className="button"
            disabled={quickAdd.isPending || query.isPending}
            onClick={() => quickAdd.mutate(kind)}>
            {quickAdd.isPending && quickAdd.variables === kind ? 'Adding...' : careLabel(kind)}
          </button>
        ))}
      </div>

      {quickAdd.isError && <p className="alert" role="alert">{messageFor(quickAdd.error)}</p>}
      {remove.isError && <p className="alert" role="alert">{messageFor(remove.error)}</p>}

      {formTarget !== null && <CareLogForm target={formTarget} onClose={closeForm} />}

      {listContent}
    </section>
  );
}
