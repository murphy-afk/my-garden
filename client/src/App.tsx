import { useEffect, useState } from 'react';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; serverStatus: string };

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth(): Promise<void> {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Health check returned status ${response.status}`);
        }

        const body = (await response.json()) as { status?: string };

        if (typeof body.status !== 'string') {
          throw new Error('Health check response is missing a status field');
        }

        setHealth({ kind: 'ready', serverStatus: body.status });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setHealth({ kind: 'error', message });
      }
    }

    void loadHealth();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="page">
      <h1>Garden</h1>
      <section className="panel" aria-labelledby="connection-heading">
        <h2 id="connection-heading">Connection</h2>
        {health.kind === 'loading' && <p>Checking the server.</p>}
        {health.kind === 'error' && (
          <p role="alert">Could not reach the server: {health.message}</p>
        )}
        {health.kind === 'ready' && <p>Server reports: {health.serverStatus}</p>}
      </section>
    </main>
  );
}
