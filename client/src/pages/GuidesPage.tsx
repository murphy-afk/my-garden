import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BookOpen, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { messageFor } from '../api/client';
import {
  categoryLabel,
  deleteGuide,
  guideCategories,
  guideKeys,
  listGuides,
  tagsOf,
  type GuideCategory,
  type GuideSummary,
} from '../api/guides';
import { GuideForm, type GuideFormTarget } from './GuideForm';
import '../styles/guides.css';

export function GuidesPage() {
  const [categoryFilter, setCategoryFilter] = useState<GuideCategory | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [formTarget, setFormTarget] = useState<GuideFormTarget | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const hasFilters = categoryFilter !== '' || tagFilter !== '';

  const query = useQuery({
    queryKey: [...guideKeys.all, 'list', { categoryFilter, tagFilter }],
    queryFn: () =>
      listGuides({
        category: categoryFilter === '' ? undefined : categoryFilter,
        tag: tagFilter === '' ? undefined : tagFilter,
      }),
  });

  // The tag menu is read from the category alone, so choosing a tag can never
  // shrink it down to the one tag already chosen.
  const tagSourceQuery = useQuery({
    queryKey: [...guideKeys.all, 'tag-source', { categoryFilter }],
    queryFn: () => listGuides(categoryFilter === '' ? {} : { category: categoryFilter }),
  });

  const guides = query.data ?? [];
  const tagOptions = tagsOf(tagSourceQuery.data ?? []);

  const remove = useMutation({
    mutationFn: (id: number) => deleteGuide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guideKeys.all });
      // The row that held focus is about to disappear, so focus moves to the
      // button that adds the next guide.
      addButtonRef.current?.focus();
    },
  });

  function openCreate(): void {
    setFormTarget({ mode: 'create' });
  }

  function openEdit(guide: GuideSummary, trigger: HTMLElement): void {
    triggerRef.current = trigger;
    setFormTarget({ mode: 'edit', guide });
  }

  function closeForm(): void {
    setFormTarget(null);
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else addButtonRef.current?.focus();
  }

  function clearFilters(): void {
    setCategoryFilter('');
    setTagFilter('');
  }

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="state" role="status">
        <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
        <p className="state__text">Loading guides...</p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="state state--error" role="alert">
        <h2 className="state__title">Could not load guides</h2>
        <p className="state__text">{messageFor(query.error)}</p>
        <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
          <RefreshCw aria-hidden="true" size={16} /> Try again
        </button>
      </div>
    );
  } else if (guides.length === 0 && !hasFilters) {
    content = (
      <div className="state">
        <BookOpen className="state__icon" aria-hidden="true" size={32} />
        <h2 className="state__title">No guides yet</h2>
        <p className="state__text">
          Add the first guide and it appears on this shelf, with its source linked for the full article.
        </p>
        <button type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add guide
        </button>
      </div>
    );
  } else if (guides.length === 0) {
    content = (
      <div className="state">
        <h2 className="state__title">No guides match these filters</h2>
        <p className="state__text">Choose another shelf or tag to see the rest.</p>
        <button type="button" className="button button--secondary" onClick={clearFilters}>
          <RefreshCw aria-hidden="true" size={16} /> Clear filters
        </button>
      </div>
    );
  } else {
    content = (
      <ul className="guides__list">
        {guides.map((guide) => (
          <li className="guides__entry" key={guide.id}>
            <div className="guides__entry-main">
              <p className="guides__line">
                <Link className="guides__title" to={`/guides/${guide.id}`}>{guide.title}</Link>
                <span className="guides__category">{categoryLabel(guide.category)}</span>
              </p>

              {guide.summary !== null && <p className="guides__summary">{guide.summary}</p>}

              {guide.tags.length > 0 && (
                <p className="guides__tags">
                  {guide.tags.map((tag) => (
                    <button
                      type="button"
                      className="guides__tag"
                      key={tag}
                      onClick={() => setTagFilter(tag)}>
                      {tag}
                    </button>
                  ))}
                </p>
              )}

              {guide.sourceName !== null && (
                <p className="guides__source">
                  Source: {guide.sourceUrl !== null
                    ? <a href={guide.sourceUrl} target="_blank" rel="noreferrer">{guide.sourceName}</a>
                    : guide.sourceName}
                </p>
              )}
            </div>

            <div className="guides__actions">
              <button
                type="button"
                className="button button--quiet button--icon"
                aria-label={`Edit ${guide.title}`}
                title="Edit"
                onClick={(event) => openEdit(guide, event.currentTarget)}>
                <Pencil aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className="button button--quiet button--icon"
                aria-label={`Delete ${guide.title}`}
                title="Delete"
                disabled={remove.isPending && remove.variables === guide.id}
                onClick={() => {
                  if (window.confirm(`Delete ${guide.title}? This cannot be undone.`)) {
                    remove.mutate(guide.id);
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
    <section className="guides" aria-labelledby="guides-heading">
      <header className="guides__header">
        <div>
          <h1 id="guides-heading">Guides</h1>
          <p className="guides__intro">
            Gardening guides and notes, each with the source it was written from.
          </p>
        </div>
        <button ref={addButtonRef} type="button" className="button" onClick={openCreate}>
          <Plus aria-hidden="true" size={16} /> Add guide
        </button>
      </header>

      {formTarget !== null && <GuideForm target={formTarget} onClose={closeForm} />}

      {tagSourceQuery.isError && (
        <p className="alert" role="alert">
          The tag filter could not be loaded: {messageFor(tagSourceQuery.error)}
        </p>
      )}

      {(hasFilters || guides.length > 0) && (
        <div className="guides__filters">
          <div className="field guides__filter">
            <label className="field__label" htmlFor="guides-filter-category">Category</label>
            <select
              id="guides-filter-category"
              className="select"
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value as GuideCategory | '');
                setTagFilter('');
              }}>
              <option value="">All categories</option>
              {guideCategories.map((category) => (
                <option key={category} value={category}>{categoryLabel(category)}</option>
              ))}
            </select>
          </div>

          <div className="field guides__filter">
            <label className="field__label" htmlFor="guides-filter-tag">Tag</label>
            <select
              id="guides-filter-tag"
              className="select"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">All tags</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <p className="guides__count">
            {guides.length} {guides.length === 1 ? 'guide' : 'guides'}
          </p>
        </div>
      )}

      {remove.isError && <p className="alert" role="alert">{messageFor(remove.error)}</p>}

      {content}
    </section>
  );
}
