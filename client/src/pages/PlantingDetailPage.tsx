import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, LoaderCircle, Pencil, RefreshCw, RotateCcw } from 'lucide-react';
import { messageFor } from '../api/client';
import {
  endPlanting,
  getPlanting,
  labelFor,
  plantingKeys,
  plantingName,
  reopenPlanting,
  todayIsoDate,
} from '../api/plantings';
import { PlantingForm, type FormTarget } from './PlantingForm';
import '../styles/plantings.css';

export function PlantingDetailPage() {
  const params = useParams();
  const rawId = params['id'];
  const id = Number(rawId);
  const validId = rawId !== undefined && rawId !== '' && Number.isInteger(id) && id >= 1;

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [ending, setEnding] = useState(false);
  const [endedOn, setEndedOn] = useState('');
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const endButtonRef = useRef<HTMLButtonElement>(null);
  const reopenButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
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
    </section>
  );
}
