import '../styles/placeholder.css';

type PlaceholderPageProps = {
  title: string;
  description: string;
  session?: string | undefined;
};

export function PlaceholderPage({ title, description, session }: PlaceholderPageProps) {
  return (
    <section className="placeholder" aria-labelledby="placeholder-heading">
      <h1 id="placeholder-heading">{title}</h1>
      <p className="placeholder__note">{description}</p>
      {session !== undefined && <p className="placeholder__session">Planned for session {session}</p>}
    </section>
  );
}
