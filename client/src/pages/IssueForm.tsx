import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import { todayIsoDate } from '../api/date';
import {
  createIssue,
  issueKinds,
  issueKeys,
  issueLabel,
  issueStatuses,
  issueSeverities,
  severityLabel,
  statusLabel,
  updateIssue,
  type Issue,
  type IssueInput,
  type IssueKind,
  type IssueSeverity,
  type IssueStatus,
} from '../api/issues';

export type IssueFormTarget =
  | { mode: 'create'; plantingId: number }
  | { mode: 'edit'; issue: Issue };

type IssueFormProps = {
  target: IssueFormTarget;
  onClose: () => void;
};

/** Every control holds a string; the text fields are trimmed on the way out. */
type FormValues = {
  kind: IssueKind;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  openedOn: string;
  resolvedOn: string;
  resolution: string;
};

function initialValues(target: IssueFormTarget): FormValues {
  if (target.mode === 'create') {
    return {
      kind: 'pest',
      title: '',
      description: '',
      severity: 'medium',
      status: 'open',
      openedOn: todayIsoDate(),
      resolvedOn: '',
      resolution: '',
    };
  }

  const issue = target.issue;
  return {
    kind: issue.kind,
    title: issue.title,
    description: issue.description ?? '',
    severity: issue.severity,
    status: issue.status,
    openedOn: issue.openedOn,
    resolvedOn: issue.resolvedOn ?? '',
    resolution: issue.resolution ?? '',
  };
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function IssueForm({ target, onClose }: IssueFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: IssueInput) =>
      target.mode === 'create' ? createIssue(target.plantingId, input) : updateIssue(target.issue.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.all });
      onClose();
    },
  });

  const fieldErrors = readFieldErrors(save.error);
  const formError =
    save.error !== null && Object.keys(fieldErrors).length === 0 ? messageFor(save.error) : null;

  /**
   * Replaces part of the form. Resolving without a date lands on today, which
   * is the day the gardener usually notices the problem is over. Editing also
   * drops the previous server answer.
   */
  function change(patch: Partial<FormValues>): void {
    setValues((current) => {
      const next = { ...current, ...patch };
      if (next.status === 'resolved' && next.resolvedOn === '') {
        next.resolvedOn = todayIsoDate();
      }
      return next;
    });
    if (save.isError) save.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const input: IssueInput = {
      kind: values.kind,
      title: values.title.trim(),
      description: readText(values.description),
      severity: values.severity,
      status: values.status,
      openedOn: values.openedOn,
      resolvedOn: values.status === 'resolved' ? values.resolvedOn : null,
      resolution: values.status === 'resolved' ? readText(values.resolution) : null,
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Open issue' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="issue-form-heading">
      <h2 className="form-card__title" id="issue-form-heading">
        {target.mode === 'create' ? 'Open an issue' : `Edit ${target.issue.title}`}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="issue-title">Title</label>
          <input
            id="issue-title"
            className="input"
            type="text"
            required
            maxLength={200}
            autoFocus={target.mode === 'create'}
            value={values.title}
            onChange={(event) => change({ title: event.target.value })}
            aria-invalid={fieldErrors['title'] !== undefined}
            aria-describedby="issue-title-error" />
          <p className="field__error" id="issue-title-error">{fieldErrors['title']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="issue-kind">Type</label>
          <select
            id="issue-kind"
            className="select"
            value={values.kind}
            onChange={(event) => change({ kind: event.target.value as IssueKind })}
            aria-invalid={fieldErrors['kind'] !== undefined}
            aria-describedby="issue-kind-error">
            {issueKinds.map((kind) => (
              <option key={kind} value={kind}>{issueLabel(kind)}</option>
            ))}
          </select>
          <p className="field__error" id="issue-kind-error">{fieldErrors['kind']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="issue-severity">Severity</label>
          <select
            id="issue-severity"
            className="select"
            value={values.severity}
            onChange={(event) => change({ severity: event.target.value as IssueSeverity })}
            aria-invalid={fieldErrors['severity'] !== undefined}
            aria-describedby="issue-severity-error">
            {issueSeverities.map((severity) => (
              <option key={severity} value={severity}>{severityLabel(severity)}</option>
            ))}
          </select>
          <p className="field__error" id="issue-severity-error">{fieldErrors['severity']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="issue-status">Status</label>
          <select
            id="issue-status"
            className="select"
            value={values.status}
            onChange={(event) => change({ status: event.target.value as IssueStatus })}
            aria-invalid={fieldErrors['status'] !== undefined}
            aria-describedby="issue-status-error">
            {issueStatuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
          <p className="field__error" id="issue-status-error">{fieldErrors['status']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="issue-opened-on">Opened on</label>
          <input
            id="issue-opened-on"
            className="input"
            type="date"
            required
            value={values.openedOn}
            onChange={(event) => change({ openedOn: event.target.value })}
            aria-invalid={fieldErrors['openedOn'] !== undefined}
            aria-describedby="issue-opened-on-error" />
          <p className="field__error" id="issue-opened-on-error">{fieldErrors['openedOn']}</p>
        </div>

        {values.status === 'resolved' && (
          <div className="field">
            <label className="field__label" htmlFor="issue-resolved-on">Resolved on</label>
            <input
              id="issue-resolved-on"
              className="input"
              type="date"
              required
              value={values.resolvedOn}
              onChange={(event) => change({ resolvedOn: event.target.value })}
              aria-invalid={fieldErrors['resolvedOn'] !== undefined}
              aria-describedby="issue-resolved-on-error" />
            <p className="field__error" id="issue-resolved-on-error">{fieldErrors['resolvedOn']}</p>
          </div>
        )}

        {values.status === 'resolved' && (
          <div className="field field--full">
            <label className="field__label" htmlFor="issue-resolution">Resolution</label>
            <textarea
              id="issue-resolution"
              className="textarea"
              maxLength={4000}
              value={values.resolution}
              onChange={(event) => change({ resolution: event.target.value })}
              aria-invalid={fieldErrors['resolution'] !== undefined}
              aria-describedby="issue-resolution-hint issue-resolution-error" />
            <p className="field__hint" id="issue-resolution-hint">
              What was done about it, or how it ended.
            </p>
            <p className="field__error" id="issue-resolution-error">{fieldErrors['resolution']}</p>
          </div>
        )}

        <div className="field field--full">
          <label className="field__label" htmlFor="issue-description">Description</label>
          <textarea
            id="issue-description"
            className="textarea"
            maxLength={4000}
            value={values.description}
            onChange={(event) => change({ description: event.target.value })}
            aria-invalid={fieldErrors['description'] !== undefined}
            aria-describedby="issue-description-error" />
          <p className="field__error" id="issue-description-error">{fieldErrors['description']}</p>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
          disabled={save.isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
