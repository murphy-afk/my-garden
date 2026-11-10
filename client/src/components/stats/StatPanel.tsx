import { useId, type ReactNode } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { messageFor } from '../../api/client';

/** The part of a query result a panel needs; kept narrow so any query fits. */
type PanelQuery = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

type StatPanelProps = {
  title: string;
  /** One line under the title saying what the figure counts. */
  note?: string;
  query: PanelQuery;
  /** Set when the data arrived but has nothing to show yet. */
  isEmpty?: boolean;
  emptyText?: string;
  /** Spans the whole grid, for a chart that needs the width. */
  wide?: boolean;
  children: ReactNode;
};

/**
 * One card of the dashboard. Every panel answers the same three questions in
 * the same shape: is it loading, did it fail, is there nothing to say yet.
 */
export function StatPanel({ title, note, query, isEmpty = false, emptyText, wide = false, children }: StatPanelProps) {
  const headingId = useId();

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading...</p>
      </div>
    );
  } else if (query.isError) {
    body = (
      <div className="state state--error" role="alert">
        <h3 className="state__title">Could not load this figure</h3>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (isEmpty) {
    body = (
      <div className="state">
        <p className="state__text">{emptyText ?? 'Nothing to show for these filters yet.'}</p>
      </div>
    );
  } else {
    body = children;
  }

  return (
    <section
      className={wide ? 'stat-panel stat-panel--wide' : 'stat-panel'}
      aria-labelledby={headingId}>
      <header className="stat-panel__head">
        <h2 className="stat-panel__title" id={headingId}>{title}</h2>
        {note !== undefined && <p className="stat-panel__note">{note}</p>}
      </header>
      {body}
    </section>
  );
}
