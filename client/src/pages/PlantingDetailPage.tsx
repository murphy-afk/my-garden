import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, LoaderCircle, Milestone as MilestoneIcon, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { messageFor } from '../api/client';
import { todayIsoDate } from '../api/date';
import { PlantingCare } from '../components/PlantingCare';
import { PlantingIssues } from '../components/PlantingIssues';
import {
  deleteMilestone,
  listMilestones,
  milestoneKeys,
  milestoneLabel,
  type Milestone,
} from '../api/milestones';
import {
  endPlanting,
  getPlanting,
  labelFor,
  plantingKeys,
  plantingName,
  reopenPlanting,
} from '../api/plantings';
import { MilestoneForm, type MilestoneFormTarget } from './MilestoneForm';
import { PlantingForm, type FormTarget } from './PlantingForm';
import '../styles/plantings.css';

export function PlantingDetailPage() {
  const params = useParams();
  const rawId = params['id'];
  const id = Number(rawId);
  const validId = rawId !== undefined && rawId !== '' && Number.isInteger(id) && id >= 1;

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [milestoneTarget, setMilestoneTarget] = useState<MilestoneFormTarget | null>(null);
  const [ending, setEnding] = useState(false);
  const [endedOn, setEndedOn] = useState('');
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const endButtonRef = useRef<HTMLButtonElement>(null);
  const reopenButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const addMilestoneRef = useRef<HTMLButtonElement>(null);
  const milestoneTriggerRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...plantingKeys.all, 'detail', id],
    queryFn: () => getPlanting(id),
    enabled: validId,
  });
  const planting = query.data;

  const end = useMutation({
    mutationFn: (date: string) => endPlanting(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plantingKeys.all });
      setEnding(false);
    },
  });

  const reopen = useMutation({
    mutationFn: () => reopenPlanting(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plantingKeys.all }),
  });

  // The timeline belongs to the planting, so it waits until one has loaded.
  const milestones = useQuery({
    queryKey: milestoneKeys.forPlanting(id),
    queryFn: () => listMilestones(id),
    enabled: validId && query.isSuccess,
  });

  const removeMilestone = useMutation({
    mutationFn: (milestoneId: number) => deleteMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milestoneKeys.all });
      // The row that held focus is about to disappear, so focus moves to the
      // button that adds the next milestone.
      addMilestoneRef.current?.focus();
    },
  });

  // Once the planting has ended, the button that opened the end form is gone,
  // so the focus it would have kept moves to the reopen button instead.
  useEffect(() => {
    if (!ending && end.isSuccess) reopenButtonRef.current?.focus();
  }, [ending, end.isSuccess]);

  // Opening the end form lands in its date field, so the date can be typed over.
  useEffect(() => {
    if (ending) dateInputRef.current?.focus();
  }, [ending]);

  function openEdit(): void {
    if (planting === undefined) return;
    setFormTarget({ mode: 'edit', planting });
  }

  function closeEdit(): void {
    setFormTarget(null);
    const trigger = editButtonRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
  }

  /** The end date starts at today, never before the planting went in. */
  function openEnd(): void {
    const today = todayIsoDate();
    setEndedOn(planting !== undefined && planting.plantedOn > today ? planting.plantedOn : today);
    setEnding(true);
  }

  function closeEnd(): void {
    setEnding(false);
    end.reset();
    endButtonRef.current?.focus();
  }

  function handleEndSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    end.mutate(endedOn);
  }

  function openAddMilestone(trigger: HTMLElement): void {
    milestoneTriggerRef.current = trigger;
    setMilestoneTarget({ mode: 'create', plantingId: id });
  }

  function openEditMilestone(milestone: Milestone, trigger: HTMLElement): void {
    milestoneTriggerRef.current = trigger;
    setMilestoneTarget({ mode: 'edit', milestone });
  }

  function closeMilestoneForm(): void {
    setMilestoneTarget(null);
    // The trigger may have left the timeline (an empty state collapsing away),
    // so fall back to the section button, which is always there.
    const trigger = milestoneTriggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addMilestoneRef.current?.focus();
  }

  if (!validId) {
    return (
      <section className="planting" aria-labelledby="planting-heading">
        <Link className="planting__back" to="/plantings">
          <ArrowLeft aria-hidden="true" size={16} /> Plantings
        </Link>
        <div className="state state--error" role="alert">
          <h2 className="state__title" id="planting-heading">That planting link is not valid</h2>
          <p className="state__text">A planting is opened by its own address, which carries a whole number.</p>
          <Link className="button button--secondary" to="/plantings">
            <ArrowLeft aria-hidden="true" size={16} /> Back to plantings
          </Link>
        </div>
      </section>
    );
  }

  if (query.isPending) {
    return (
      <section className="planting" aria-labelledby="planting-heading">
        <Link className="planting__back" to="/plantings">
          <ArrowLeft aria-hidden="true" size={16} /> Plantings
        </Link>
        <div className="state" role="status">
          <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
          <p className="state__text">Loading planting...</p>
        </div>
      </section>
    );
  }

  if (query.isError || planting === undefined) {
    return (
      <section className="planting" aria-labelledby="planting-heading">
        <Link className="planting__back" to="/plantings">
          <ArrowLeft aria-hidden="true" size={16} /> Plantings
        </Link>
        <div className="state state--error" role="alert">
          <h2 className="state__title" id="planting-heading">Could not load this planting</h2>
          <p className="state__text">{messageFor(query.error)}</p>
          <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
            <RefreshCw aria-hidden="true" size={16} /> Try again
          </button>
        </div>
      </section>
    );
  }

  const entries: { term: string; value: string }[] = [
    { term: 'Area', value: planting.area.name },
    { term: 'Planted on', value: planting.plantedOn },
    { term: 'Quantity', value: String(planting.quantity) },
    { term: 'Source', value: labelFor(planting.source) },
    { term: 'Status', value: labelFor(planting.status) },
  ];
  if (planting.endedOn !== null) entries.push({ term: 'Ended on', value: planting.endedOn });

  return (
    <section className="planting" aria-labelledby="planting-heading">
      <Link className="planting__back" to="/plantings">
        <ArrowLeft aria-hidden="true" size={16} /> Plantings
      </Link>

      <header className="planting__header">
        <div>
          <h1 id="planting-heading">{plantingName(planting)}</h1>
          <p className="planting__meta">
            <span className={`planting__badge planting__badge--${planting.status}`}>{labelFor(planting.status)}</span>
            <span>in {planting.area.name}</span>
          </p>
        </div>
        <div className="planting__actions">
          <button ref={editButtonRef} type="button" className="button button--secondary" onClick={openEdit}>
            <Pencil aria-hidden="true" size={16} /> Edit planting
          </button>
          {planting.status === 'active' ? (
            <button ref={endButtonRef} type="button" className="button button--secondary" onClick={openEnd}>
              <Flag aria-hidden="true" size={16} /> End planting
            </button>
          ) : (
            <button
              ref={reopenButtonRef}
              type="button"
              className="button button--secondary"
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}>
              <RotateCcw aria-hidden="true" size={16} /> Reopen planting
            </button>
          )}
        </div>
      </header>

      {reopen.isError && <p className="alert" role="alert">{messageFor(reopen.error)}</p>}

      {formTarget !== null && (
        <PlantingForm target={formTarget} onClose={closeEdit} />
      )}

      {ending && (
        <form className="form-card" onSubmit={handleEndSubmit} aria-labelledby="planting-end-heading">
          <h2 className="form-card__title" id="planting-end-heading">End this planting</h2>
          {end.isError && <p className="alert" role="alert">{messageFor(end.error)}</p>}

          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="planting-end-date">Ended on</label>
              <input
                id="planting-end-date"
                ref={dateInputRef}
                className="input"
                type="date"
                required
                value={endedOn}
                onChange={(event) => setEndedOn(event.target.value)}
                aria-describedby="planting-end-date-hint" />
              <p className="field__hint" id="planting-end-date-hint">The date the planting finished.</p>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="button" disabled={end.isPending}>
              {end.isPending ? 'Saving...' : 'End planting'}
            </button>
            <button type="button" className="button button--secondary" onClick={closeEnd} disabled={end.isPending}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <dl className="planting__record">
        {entries.map((entry) => (
          <div className="planting__entry" key={entry.term}>
            <dt className="planting__term">{entry.term}</dt>
            <dd className="planting__value">{entry.value}</dd>
          </div>
        ))}
      </dl>

      {planting.notes !== null && (
        <div className="planting__notes">
          <h2 className="planting__notes-title">Notes</h2>
          <p className="planting__notes-body">{planting.notes}</p>
        </div>
      )}

      <section className="planting__section" aria-labelledby="planting-timeline-heading">
        <div className="planting__section-head">
          <h2 id="planting-timeline-heading">Timeline</h2>
          <button
            ref={addMilestoneRef}
            type="button"
            className="button button--secondary"
            onClick={(event) => openAddMilestone(event.currentTarget)}>
            <Plus aria-hidden="true" size={16} /> Add milestone
          </button>
        </div>

        {milestoneTarget !== null && (
          <MilestoneForm target={milestoneTarget} onClose={closeMilestoneForm} />
        )}

        {removeMilestone.isError && <p className="alert" role="alert">{messageFor(removeMilestone.error)}</p>}

        {milestones.isPending && (
          <div className="state" role="status">
            <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
            <p className="state__text">Loading timeline...</p>
          </div>
        )}

        {milestones.isError && (
          <div className="state state--error" role="alert">
            <h3 className="state__title">Could not load the timeline</h3>
            <p className="state__text">{messageFor(milestones.error)}</p>
            <button type="button" className="button button--secondary" onClick={() => milestones.refetch()}>
              <RefreshCw aria-hidden="true" size={16} /> Try again
            </button>
          </div>
        )}

        {milestones.isSuccess && milestones.data.length === 0 && milestoneTarget === null && (
          <div className="state">
            <MilestoneIcon className="state__icon" aria-hidden="true" size={32} />
            <h3 className="state__title">No milestones yet</h3>
            <p className="state__text">
              Record sowing, germinating, flowering and the rest as they happen.
            </p>
            <button
              type="button"
              className="button"
              onClick={(event) => openAddMilestone(event.currentTarget)}>
              <Plus aria-hidden="true" size={16} /> Add the first milestone
            </button>
          </div>
        )}

        {milestones.isSuccess && milestones.data.length > 0 && (
          <ol className="timeline">
            {milestones.data.map((milestone) => (
              <li className="timeline__item" key={milestone.id}>
                <span className="timeline__marker" aria-hidden="true" />
                <div className="timeline__body">
                  <p className="timeline__date">
                    <time dateTime={milestone.occurredOn}>{milestone.occurredOn}</time>
                  </p>
                  <p className="timeline__kind">{milestoneLabel(milestone.kind)}</p>
                  {milestone.note !== null && <p className="timeline__note">{milestone.note}</p>}
                </div>
                <div className="timeline__actions">
                  <button
                    type="button"
                    className="button button--quiet button--icon"
                    aria-label={`Edit ${milestoneLabel(milestone.kind)} milestone`}
                    title="Edit"
                    onClick={(event) => openEditMilestone(milestone, event.currentTarget)}>
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button
                    type="button"
                    className="button button--quiet button--icon"
                    aria-label={`Delete ${milestoneLabel(milestone.kind)} milestone`}
                    title="Delete"
                    disabled={removeMilestone.isPending && removeMilestone.variables === milestone.id}
                    onClick={() => {
                      if (window.confirm('Delete this milestone? This cannot be undone.')) {
                        removeMilestone.mutate(milestone.id);
                      }
                    }}>
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <PlantingCare plantingId={planting.id} />

      <PlantingIssues plantingId={planting.id} />
    </section>
  );
}
