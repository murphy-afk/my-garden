import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageFor, readFieldErrors } from '../api/client';
import {
  categoryLabel,
  createGuide,
  getGuide,
  guideCategories,
  guideKeys,
  updateGuide,
  type GuideCategory,
  type GuideInput,
  type GuideSummary,
} from '../api/guides';

/**
 * The list carries no body, so an edit reads the full guide before the form
 * can show it. The target is a list row either way.
 */
export type GuideFormTarget = { mode: 'create' } | { mode: 'edit'; guide: GuideSummary };

type GuideFormProps = {
  target: GuideFormTarget;
  onClose: () => void;
};

/** Every control holds a string; tags are split and counts converted on the way out. */
type FormValues = {
  title: string;
  category: GuideCategory;
  summary: string;
  body: string;
  sourceName: string;
  sourceUrl: string;
  publishedOn: string;
  tags: string;
};

function initialValues(target: GuideFormTarget, body: string): FormValues {
  if (target.mode === 'create') {
    return {
      title: '',
      category: 'vegetable_growing',
      summary: '',
      body: '',
      sourceName: '',
      sourceUrl: '',
      publishedOn: '',
      tags: '',
    };
  }

  const guide = target.guide;
  return {
    title: guide.title,
    category: guide.category,
    summary: guide.summary ?? '',
    body,
    sourceName: guide.sourceName ?? '',
    sourceUrl: guide.sourceUrl ?? '',
    publishedOn: guide.publishedOn ?? '',
    tags: guide.tags.join(', '),
  };
}

function readText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** 'compost, soil ' becomes ['compost', 'soil']; the API drops repeats for us. */
function readTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}

export function GuideForm({ target, onClose }: GuideFormProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues | null>(() =>
    target.mode === 'create' ? initialValues(target, '') : null,
  );

  // -1 never reaches the API: the query is off until an edit needs it.
  const guideId = target.mode === 'edit' ? target.guide.id : -1;
  const fullQuery = useQuery({
    queryKey: guideKeys.forGuide(guideId),
    queryFn: () => getGuide(guideId),
    enabled: target.mode === 'edit',
  });

  const save = useMutation({
    mutationFn: (input: GuideInput) =>
      target.mode === 'create' ? createGuide(input) : updateGuide(target.guide.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guideKeys.all });
      onClose();
    },
  });

  // The body only exists on the full guide, so an edit waits for it to arrive.
  useEffect(() => {
    if (target.mode === 'edit' && values === null && fullQuery.data !== undefined) {
      setValues(initialValues(target, fullQuery.data.body));
    }
  }, [target, values, fullQuery.data]);

  if (values === null) {
    return (
      <form className="form-card" aria-busy="true">
        <h2 className="form-card__title">Loading guide...</h2>
        {fullQuery.isError && <p className="alert" role="alert">{messageFor(fullQuery.error)}</p>}
        <div className="form-actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const fieldErrors = readFieldErrors(save.error);
  const formError =
    save.error !== null && Object.keys(fieldErrors).length === 0 ? messageFor(save.error) : null;

  /** Replaces part of the form. Editing also drops the previous server answer. */
  function change(patch: Partial<FormValues>): void {
    setValues((current) => (current === null ? current : { ...current, ...patch }));
    if (save.isError) save.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (values === null) return;

    const input: GuideInput = {
      title: values.title.trim(),
      category: values.category,
      summary: readText(values.summary),
      body: values.body.trim(),
      sourceName: readText(values.sourceName),
      sourceUrl: readText(values.sourceUrl),
      publishedOn: readText(values.publishedOn),
      tags: readTags(values.tags),
    };

    save.mutate(input);
  }

  const submitLabel = target.mode === 'create' ? 'Add guide' : 'Save changes';

  return (
    <form className="form-card" onSubmit={handleSubmit} aria-labelledby="guide-form-heading">
      <h2 className="form-card__title" id="guide-form-heading">
        {target.mode === 'create' ? 'Add a guide' : 'Edit guide'}
      </h2>

      {formError !== null && <p className="alert" role="alert">{formError}</p>}

      <div className="form-grid">
        <div className="field field--full">
          <label className="field__label" htmlFor="guide-title">Title</label>
          <input
            id="guide-title"
            className="input"
            type="text"
            required
            maxLength={200}
            autoFocus={target.mode === 'create'}
            value={values.title}
            onChange={(event) => change({ title: event.target.value })}
            aria-invalid={fieldErrors['title'] !== undefined}
            aria-describedby="guide-title-error" />
          <p className="field__error" id="guide-title-error">{fieldErrors['title']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="guide-category">Category</label>
          <select
            id="guide-category"
            className="select"
            value={values.category}
            onChange={(event) => change({ category: event.target.value as GuideCategory })}
            aria-invalid={fieldErrors['category'] !== undefined}
            aria-describedby="guide-category-error">
            {guideCategories.map((category) => (
              <option key={category} value={category}>{categoryLabel(category)}</option>
            ))}
          </select>
          <p className="field__error" id="guide-category-error">{fieldErrors['category']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="guide-tags">Tags</label>
          <input
            id="guide-tags"
            className="input"
            type="text"
            value={values.tags}
            onChange={(event) => change({ tags: event.target.value })}
            aria-invalid={fieldErrors['tags'] !== undefined}
            aria-describedby="guide-tags-hint guide-tags-error" />
          <p className="field__hint" id="guide-tags-hint">Comma separated, up to ten.</p>
          <p className="field__error" id="guide-tags-error">{fieldErrors['tags']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="guide-summary">Summary</label>
          <textarea
            id="guide-summary"
            className="textarea"
            maxLength={1000}
            value={values.summary}
            onChange={(event) => change({ summary: event.target.value })}
            aria-invalid={fieldErrors['summary'] !== undefined}
            aria-describedby="guide-summary-hint guide-summary-error" />
          <p className="field__hint" id="guide-summary-hint">One or two lines shown in the list.</p>
          <p className="field__error" id="guide-summary-error">{fieldErrors['summary']}</p>
        </div>

        <div className="field field--full">
          <label className="field__label" htmlFor="guide-body">Guide text</label>
          <textarea
            id="guide-body"
            className="textarea guide-form__body"
            required
            maxLength={200000}
            value={values.body}
            onChange={(event) => change({ body: event.target.value })}
            aria-invalid={fieldErrors['body'] !== undefined}
            aria-describedby="guide-body-hint guide-body-error" />
          <p className="field__hint" id="guide-body-hint">A blank line starts a new paragraph.</p>
          <p className="field__error" id="guide-body-error">{fieldErrors['body']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="guide-source-name">Source name</label>
          <input
            id="guide-source-name"
            className="input"
            type="text"
            maxLength={160}
            value={values.sourceName}
            onChange={(event) => change({ sourceName: event.target.value })}
            aria-invalid={fieldErrors['sourceName'] !== undefined}
            aria-describedby="guide-source-name-hint guide-source-name-error" />
          <p className="field__hint" id="guide-source-name-hint">Who it came from, such as the RHS.</p>
          <p className="field__error" id="guide-source-name-error">{fieldErrors['sourceName']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="guide-source-url">Source link</label>
          <input
            id="guide-source-url"
            className="input"
            type="url"
            maxLength={500}
            value={values.sourceUrl}
            onChange={(event) => change({ sourceUrl: event.target.value })}
            aria-invalid={fieldErrors['sourceUrl'] !== undefined}
            aria-describedby="guide-source-url-hint guide-source-url-error" />
          <p className="field__hint" id="guide-source-url-hint">Where the full article lives.</p>
          <p className="field__error" id="guide-source-url-error">{fieldErrors['sourceUrl']}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="guide-published-on">Published on</label>
          <input
            id="guide-published-on"
            className="input"
            type="date"
            value={values.publishedOn}
            onChange={(event) => change({ publishedOn: event.target.value })}
            aria-invalid={fieldErrors['publishedOn'] !== undefined}
            aria-describedby="guide-published-on-hint guide-published-on-error" />
          <p className="field__hint" id="guide-published-on-hint">Optional, from the source.</p>
          <p className="field__error" id="guide-published-on-error">{fieldErrors['publishedOn']}</p>
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
