import {
  SearchResponseSchema,
  type ChunkingConfig,
  type SearchResponse,
  type Tenant,
} from "@treasury-rag/contracts";
import { useState, type FormEvent } from "react";

type Strategy = ChunkingConfig["strategy"];

export function SearchLab() {
  const [query, setQuery] = useState("¿Un pago parcial cancela la factura?");
  const [tenant, setTenant] = useState<Tenant>("acme");
  const [strategy, setStrategy] = useState<Strategy>("characters");
  const [chunkSize, setChunkSize] = useState(300);
  const [overlap, setOverlap] = useState(80);
  const [maxChunkSize, setMaxChunkSize] = useState(600);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.7);
  const [tenantFilterEnabled, setTenantFilterEnabled] = useState(true);
  const [response, setResponse] = useState<SearchResponse>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  function updateChunkSize(nextValue: number) {
    const normalized = Math.max(1, Math.min(5_000, nextValue));
    setChunkSize(normalized);
    setOverlap((current) => Math.min(current, normalized - 1));
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    const chunking: ChunkingConfig = strategy === "characters"
      ? { strategy, chunkSize, overlap }
      : { strategy, maxChunkSize };

    try {
      const request = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          tenant,
          config: {
            chunking,
            topK,
            threshold,
            tenantFilterEnabled,
          },
        }),
      });
      const body: unknown = await request.json();

      if (!request.ok) {
        const message = typeof body === "object" && body !== null && "error" in body
          ? (body as { error?: { message?: string } }).error?.message
          : undefined;
        throw new Error(message ?? `La búsqueda falló (${request.status})`);
      }

      setResponse(SearchResponseSchema.parse(body));
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "La búsqueda semántica falló",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="workspace search-workspace">
      <aside className="control-panel">
        <div className="section-heading">
          <span>Slice 02</span>
          <h1>Búsqueda semántica</h1>
          <p>Convertí preguntas y chunks en vectores y compará su cercanía.</p>
        </div>

        <form onSubmit={(event) => void submitSearch(event)}>
          <div className="field-group">
            <label htmlFor="search-query">Pregunta</label>
            <textarea
              id="search-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="search-tenant">Tenant</label>
              <select
                id="search-tenant"
                value={tenant}
                onChange={(event) => setTenant(event.target.value as Tenant)}
              >
                <option value="global">Global</option>
                <option value="acme">Acme</option>
                <option value="boreal">Boreal</option>
              </select>
            </div>

            <label className="switch-field">
              <input
                type="checkbox"
                checked={tenantFilterEnabled}
                onChange={(event) => setTenantFilterEnabled(event.target.checked)}
              />
              <span>Filtrar tenant</span>
            </label>
          </div>

          <div className="field-group">
            <span className="field-label">Chunking</span>
            <div className="segmented-control">
              <button
                type="button"
                className={strategy === "characters" ? "active" : ""}
                onClick={() => setStrategy("characters")}
              >
                Caracteres
              </button>
              <button
                type="button"
                className={strategy === "headings" ? "active" : ""}
                onClick={() => setStrategy("headings")}
              >
                Headings
              </button>
            </div>
          </div>

          {strategy === "characters" ? (
            <div className="compact-grid">
              <div className="field-group compact-field">
                <label htmlFor="search-chunk-size">Chunk size</label>
                <input
                  id="search-chunk-size"
                  type="number"
                  min="1"
                  max="5000"
                  value={chunkSize}
                  onChange={(event) => updateChunkSize(Number(event.target.value))}
                />
              </div>
              <div className="field-group compact-field">
                <label htmlFor="search-overlap">Overlap</label>
                <input
                  id="search-overlap"
                  type="number"
                  min="0"
                  max={chunkSize - 1}
                  value={overlap}
                  onChange={(event) => setOverlap(
                    Math.max(0, Math.min(chunkSize - 1, Number(event.target.value))),
                  )}
                />
              </div>
            </div>
          ) : (
            <div className="field-group compact-field">
              <label htmlFor="search-max-chunk">Máximo por chunk</label>
              <input
                id="search-max-chunk"
                type="number"
                min="1"
                max="5000"
                value={maxChunkSize}
                onChange={(event) => setMaxChunkSize(
                  Math.max(1, Math.min(5_000, Number(event.target.value))),
                )}
              />
            </div>
          )}

          <div className="field-group range-field">
            <div className="range-field__header">
              <label htmlFor="top-k">Top-k</label>
              <output>{topK}</output>
            </div>
            <input
              id="top-k"
              type="range"
              min="1"
              max="10"
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
            />
          </div>

          <div className="field-group range-field">
            <div className="range-field__header">
              <label htmlFor="threshold">Threshold</label>
              <output>{threshold.toFixed(2)}</output>
            </div>
            <input
              id="threshold"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
          </div>

          <button className="search-button" type="submit" disabled={isLoading}>
            {isLoading ? "Generando embeddings…" : "Buscar evidencia"}
          </button>
        </form>

        <div className="learning-note">
          <span>Modelo local</span>
          <p>
            E5 se descarga sólo la primera vez. No usa API key y luego permanece
            cacheado junto con los embeddings SHA-256 de cada chunk.
          </p>
        </div>
      </aside>

      <section className="inspector search-inspector">
        <div className="inspector__header">
          <div>
            <p className="overline">Retrieval inspector</p>
            <h2>{response ? `Resultados para “${response.query}”` : "Buscá evidencia en el corpus"}</h2>
          </div>
          {isLoading && <span className="updating">Procesando localmente</span>}
        </div>

        {error && <div className="error-box" role="alert">{error}</div>}

        {!response && !error && (
          <div className="empty-state">
            <span>384</span>
            <h3>dimensiones locales</h3>
            <p>
              La primera búsqueda descarga el modelo cuantizado. Después podrás
              comparar ranking, threshold, top-k y fugas entre tenants.
            </p>
          </div>
        )}

        {response && (
          <>
            <div className="metrics search-metrics" aria-label="Estadísticas de búsqueda">
              <article><span>Candidatos</span><strong>{response.stats.candidateChunks}</strong></article>
              <article><span>Resultados</span><strong>{response.stats.returnedChunks}</strong></article>
              <article><span>Cache hit / miss</span><strong>{response.stats.cacheHits}/{response.stats.cacheMisses}</strong></article>
              <article><span>Duración</span><strong>{Math.round(response.stats.durationMs)}</strong><small>milisegundos</small></article>
            </div>

            <div className="model-strip">
              <span>{response.stats.provider}</span>
              <code>{response.stats.model}</code>
              <span>{response.stats.embeddingDimensions} dimensiones</span>
            </div>

            {response.results.length === 0 ? (
              <div className="empty-results">
                Ningún chunk superó el threshold actual.
              </div>
            ) : (
              <div className="result-list">
                {response.results.map((result) => (
                  <article className="result-card" key={result.chunkId}>
                    <div className="result-rank">#{result.rank}</div>
                    <div className="result-card__content">
                      <header>
                        <div>
                          <strong>{result.documentTitle}</strong>
                          <span>{result.tenant} · v{result.version} · {result.effectiveFrom}</span>
                        </div>
                        <div className="score">{result.score.toFixed(4)}</div>
                      </header>
                      <div className="score-track">
                        <i style={{ width: `${Math.max(0, result.score) * 100}%` }} />
                      </div>
                      <pre>{result.text}</pre>
                      <footer>
                        <code>{result.chunkId}</code>
                        <span>{result.startOffset}–{result.endOffset}</span>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
