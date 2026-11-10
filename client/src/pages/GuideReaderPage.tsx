import { type ReactNode } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LoaderCircle, RefreshCw } from 'lucide-react';
import { messageFor } from '../api/client';
import { categoryLabel, getGuide, guideKeys } from '../api/guides';
import '../styles/guides.css';

/** The body is plain text: a blank line starts a paragraph, a single line does not. */
function paragraphsOf(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

export function GuideReaderPage() {
  const params = useParams();
  const rawId = params['id'];
  const id = Number(rawId);
  const validId = rawId !== undefined && rawId !== '' && Number.isInteger(id) && id >= 1;

  const query = useQuery({
    queryKey: guideKeys.forGuide(id),
    queryFn: () => getGuide(id),
    enabled: validId,
  });

  function backLink(): ReactNode {
    return (
      <Link className="guide-reader__back" to="/guides">
        <ArrowLeft aria-hidden="true" size={16} /> Guides
      </Link>
    );
  }

  if (!validId) {
    return (
      <article className="guide-reader" aria-labelledby="guide-reader-heading">
        {backLink()}
        <div className="state state--error" role="alert">
          <h2 className="state__title" id="guide-reader-heading">That guide link is not valid</h2>
          <p className="state__text">A guide is opened by its own address, which carries a whole number.</p>
          <Link className="button button--secondary" to="/guides">
            <ArrowLeft aria-hidden="true" size={16} /> Back to guides
          </Link>
        </div>
      </article>
    );
  }

  if (query.isPending) {
    return (
      <article className="guide-reader" aria-labelledby="guide-reader-heading">
        {backLink()}
        <div className="state" role="status">
          <LoaderCircle className="state__spinner" aria-hidden="true" size={24} />
          <p className="state__text">Loading guide...</p>
        </div>
      </article>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <article className="guide-reader" aria-labelledby="guide-reader-heading">
        {backLink()}
        <div className="state state--error" role="alert">
          <h2 className="state__title" id="guide-reader-heading">Could not load this guide</h2>
          <p className="state__text">{messageFor(query.error)}</p>
          <button type="button" className="button button--secondary" onClick={() => query.refetch()}>
            <RefreshCw aria-hidden="true" size={16} /> Try again
          </button>
        </div>
      </article>
    );
  }

  const guide = query.data;
  const paragraphs = paragraphsOf(guide.body);

  return (
    <article className="guide-reader" aria-labelledby="guide-reader-heading">
      {backLink()}

      <header className="guide-reader__header">
        <p className="guide-reader__meta">
          <span className="guide-reader__category">{categoryLabel(guide.category)}</span>
          {guide.publishedOn !== null && (
            <span className="guide-reader__date">Published {guide.publishedOn}</span>
          )}
        </p>
        <h1 id="guide-reader-heading">{guide.title}</h1>
        {guide.summary !== null && <p className="guide-reader__summary">{guide.summary}</p>}
        {guide.tags.length > 0 && (
          <p className="guide-reader__tags">
            {guide.tags.map((tag) => (
              <span className="guide-reader__tag" key={tag}>{tag}</span>
            ))}
          </p>
        )}
      </header>

      <div className="guide-reader__body">
        {paragraphs.map((paragraph, index) => (
          <p className="guide-reader__paragraph" key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
        ))}
      </div>

      {guide.sourceName !== null && (
        <footer className="guide-reader__source">
          <p className="guide-reader__source-label">Source</p>
          <p className="guide-reader__source-value">
            {guide.sourceUrl !== null ? (
              <a href={guide.sourceUrl} target="_blank" rel="noreferrer">{guide.sourceName}</a>
            ) : (
              guide.sourceName
            )}
            {guide.sourceUrl !== null && ' for the full article.'}
          </p>
        </footer>
      )}
    </article>
  );
}
