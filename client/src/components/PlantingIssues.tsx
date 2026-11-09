import { useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bug, LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { messageFor } from '../api/client';
import { issueKeys, listIssues, type Issue } from '../api/issues';
import { IssueForm, type IssueFormTarget } from '../pages/IssueForm';
import { IssueList } from './IssueList';

type PlantingIssuesProps = {
  plantingId: number;
};

/**
 * The issues half of a planting: the problems recorded against it and the
 * form to open another. It owns its own data, so the detail page only has to
 * place it.
 */
export function PlantingIssues({ plantingId }: PlantingIssuesProps) {
  const [formTarget, setFormTarget] = useState<IssueFormTarget | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const query = useQuery({
    queryKey: issueKeys.forPlanting(plantingId),
    queryFn: () => listIssues({ plantingId }),
  });

  function openCreate(trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'create', plantingId });
  }

  function openEdit(issue: Issue, trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'edit', issue });
  }

  function closeForm(): void {
    setFormTarget(null);
    // The trigger may have left the list (an empty state collapsing away), so
    // fall back to the section button, which is always there.
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addRef.current?.focus();
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
        <h3 className="state__title">Could not load issues</h3>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (query.data.length === 0) {
    content = (
      <div className="state">
        <Bug className="state__icon" aria-hidden="true" size={32} />
        <h3 className="state__title">No issues recorded</h3>
        <p className="state__text">
          When something goes wrong with this planting, open an issue and follow it to resolution.
        </p>
      </div>
    );
  } else {
    content = <IssueList issues={query.data} onEdit={openEdit} />;
  }

  return (
    <section className="planting__section" aria-labelledby="planting-issues-heading">
      <div className="planting__section-head">
        <h2 id="planting-issues-heading">Issues</h2>
        <button
          ref={addRef}
          type="button"
          className="button button--secondary"
          onClick={(event) => openCreate(event.currentTarget)}>
          <Plus aria-hidden="true" size={16} /> Add issue
        </button>
      </div>

      {formTarget !== null && <IssueForm target={formTarget} onClose={closeForm} />}

      {content}
    </section>
  );
}
