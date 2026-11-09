import { Link } from 'react-router';
import { Pencil } from 'lucide-react';
import { issueLabel, severityLabel, statusLabel, type Issue } from '../api/issues';
import '../styles/issues.css';

type IssueListProps = {
  issues: Issue[];
  /** The issues page names the planting each row belongs to; its own page already knows. */
  showPlanting?: boolean | undefined;
  /** Opens the edit form, with the element that should get focus back. */
  onEdit: (issue: Issue, trigger: HTMLElement) => void;
};

/** The species line for an issue's planting, with the variety when it has one. */
function plantingLine(issue: Issue): string {
  const species = issue.planting.species;
  return species.variety === null ? species.name : `${species.name} ${species.variety}`;
}

export function IssueList({ issues, showPlanting = false, onEdit }: IssueListProps) {
  return (
    <ul className="issue__list">
      {issues.map((issue) => (
        <li className="issue__entry" key={issue.id}>
          <div className="issue__entry-main">
            <p className="issue__line">
              <span className="issue__title">{issue.title}</span>
              <span className={`issue__severity issue__severity--${issue.severity}`}>
                {severityLabel(issue.severity)}
              </span>
              <span className={`issue__badge issue__badge--${issue.status}`}>{statusLabel(issue.status)}</span>
              <span className="issue__kind">{issueLabel(issue.kind)}</span>
            </p>

            <p className="issue__meta">
              Opened {issue.openedOn}
              {issue.resolvedOn !== null && `, resolved ${issue.resolvedOn}`}
            </p>

            {showPlanting && (
              <p className="issue__planting">
                <Link to={`/plantings/${issue.planting.id}`}>
                  {plantingLine(issue)} in {issue.planting.area.name}
                </Link>
              </p>
            )}

            {issue.description !== null && <p className="issue__description">{issue.description}</p>}

            {issue.resolution !== null && (
              <p className="issue__resolution">Resolution: {issue.resolution}</p>
            )}
          </div>

          <div className="issue__actions">
            <button
              type="button"
              className="button button--quiet button--icon"
              aria-label={`Edit issue ${issue.title}`}
              title="Edit"
              onClick={(event) => onEdit(issue, event.currentTarget)}>
              <Pencil aria-hidden="true" size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
