import { useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Bug, LoaderCircle, RefreshCw } from 'lucide-react';
import { messageFor } from '../api/client';
import {
  issueKeys,
  issueStatuses,
  listIssues,
  statusLabel,
  type Issue,
  type IssueStatus,
} from '../api/issues';
import { IssueList } from '../components/IssueList';
import { IssueForm, type IssueFormTarget } from './IssueForm';
import '../styles/issues.css';

export function IssuesPage() {
  const [statusFilter, setStatusFilter] = useState<IssueStatus | ''>('');
  const [formTarget, setFormTarget] = useState<IssueFormTarget | null>(null);
  const filterRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const query = useQuery({
    queryKey: [...issueKeys.all, { status: statusFilter }],
    queryFn: () => listIssues(statusFilter === '' ? {} : { status: statusFilter }),
  });

  const issues = query.data ?? [];
  const hasFilters = statusFilter !== '';

  function openEdit(issue: Issue, trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'edit', issue });
  }

  function closeForm(): void {
    setFormTarget(null);
    // The row may have left the list (a resolved issue dropping out of an
    // "open" filter), so fall back to the filter, which is always there.
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else filterRef.current?.focus();
  }

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading issues...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load issues</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (issues.length === 0 && !hasFilters) {
    content = (
      <div className="state">
        <Bug className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">No issues yet</h2>
        <p className="state__text">
          Problems are opened from the page of the planting they affect, so open a planting first.
        </p>
        <Link className="button" to="/plantings">
          Go to plantings
        </Link>
      </div>
    );
  } else if (issues.length === 0) {
    content = (
      <div className="state">
        <h2 className="state__title">No issues with this status</h2>
        <p className="state__text">Choose another status to see the rest.</p>
        <button type="button" className="button button--secondary" onClick={() => setStatusFilter('')}>
          <RefreshCw aria-hidden="true" size={16} /> Show all statuses
        </button>
      </div>
    );
  } else {
    content = <IssueList issues={issues} showPlanting onEdit={openEdit} />;
  }

  return (
    <section className="issues" aria-labelledby="issues-heading">
      <header className="issues__header">
        <div>
          <h1 id="issues-heading">Issues</h1>
          <p className="issues__intro">
            Pests, disease and other problems, tracked from open to resolved.
          </p>
        </div>
      </header>

      {formTarget !== null && <IssueForm target={formTarget} onClose={closeForm} />}

      {(hasFilters || issues.length > 0) && (
        <div className="issues__filters">
          <div className="field issues__filter">
            <label className="field__label" htmlFor="issues-filter-status">Status</label>
            <select
              id="issues-filter-status"
              ref={filterRef}
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as IssueStatus | '')}>
              <option value="">All statuses</option>
              {issueStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </div>

          <p className="issues__count">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </p>
        </div>
      )}

      {content}
    </section>
  );
}
