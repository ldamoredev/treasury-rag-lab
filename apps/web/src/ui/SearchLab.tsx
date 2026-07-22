import type { FormEvent } from "react";

import type {
  SemanticSearchLabPresenter,
  SemanticSearchLabViewModel,
} from "../presenters/semantic-search-lab-presenter";

type SearchLabProps = {
  presenter: SemanticSearchLabPresenter;
  model: SemanticSearchLabViewModel;
};

export function SearchLab({ presenter, model }: SearchLabProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void presenter.submit();
  }

  return (
    <main className="workspace search-workspace">
      <aside className="control-panel">
        <div className="section-heading">
          <span>Slice 02</span>
          <h1>Búsqueda semántica</h1>
          <p>Convertí preguntas y chunks en vectores y compará su cercanía.</p>
        </div>

        <form onSubmit={submit}>
          <div className="field-group">
            <label htmlFor="search-query">Pregunta</label>
            <textarea id="search-query" value={model.query} onChange={(event) => presenter.setQuery(event.target.value)} rows={4} required />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="search-tenant">Tenant</label>
              <select id="search-tenant" value={model.tenant} onChange={(event) => presenter.setTenant(event.target.value as typeof model.tenant)}>
                <option value="global">Global</option><option value="acme">Acme</option><option value="boreal">Boreal</option>
              </select>
            </div>
            <label className="switch-field">
              <input type="checkbox" checked={model.tenantFilterEnabled} onChange={(event) => presenter.setTenantFilterEnabled(event.target.checked)} />
              <span>Filtrar tenant</span>
            </label>
          </div>

          <div className="field-group">
            <span className="field-label">Chunking</span>
            <div className="segmented-control">
              <button type="button" className={model.strategy === "characters" ? "active" : ""} onClick={() => presenter.setStrategy("characters")}>Caracteres</button>
              <button type="button" className={model.strategy === "headings" ? "active" : ""} onClick={() => presenter.setStrategy("headings")}>Headings</button>
            </div>
          </div>

          {model.strategy === "characters" ? (
            <div className="compact-grid">
              <div className="field-group compact-field">
                <label htmlFor="search-chunk-size">Chunk size</label>
                <input id="search-chunk-size" type="number" min="1" max="5000" value={model.chunkSize} onChange={(event) => presenter.setChunkSize(Number(event.target.value))} />
              </div>
              <div className="field-group compact-field">
                <label htmlFor="search-overlap">Overlap</label>
                <input id="search-overlap" type="number" min="0" max={model.chunkSize - 1} value={model.overlap} onChange={(event) => presenter.setOverlap(Number(event.target.value))} />
              </div>
            </div>
          ) : (
            <div className="field-group compact-field">
              <label htmlFor="search-max-chunk">Máximo por chunk</label>
              <input id="search-max-chunk" type="number" min="1" max="5000" value={model.maxChunkSize} onChange={(event) => presenter.setMaxChunkSize(Number(event.target.value))} />
            </div>
          )}

          <div className="field-group range-field">
            <div className="range-field__header"><label htmlFor="top-k">Top-k</label><output>{model.topK}</output></div>
            <input id="top-k" type="range" min="1" max="10" value={model.topK} onChange={(event) => presenter.setTopK(Number(event.target.value))} />
          </div>
          <div className="field-group range-field">
            <div className="range-field__header"><label htmlFor="threshold">Threshold</label><output>{model.thresholdLabel}</output></div>
            <input id="threshold" type="range" min="0" max="1" step="0.01" value={model.threshold} onChange={(event) => presenter.setThreshold(Number(event.target.value))} />
          </div>
          <button className="search-button" type="submit" disabled={model.isLoading}>{model.isLoading ? "Generando embeddings…" : "Buscar evidencia"}</button>
        </form>

        <div className="learning-note"><span>Modelo local</span><p>E5 se descarga sólo la primera vez. No usa API key y luego permanece cacheado junto con los embeddings SHA-256 de cada chunk.</p></div>
      </aside>

      <section className="inspector search-inspector">
        <div className="inspector__header">
          <div><p className="overline">Retrieval inspector</p><h2>{model.responseTitle}</h2></div>
          {model.isLoading && <span className="updating">Procesando localmente</span>}
        </div>
        {model.error && <div className="error-box" role="alert">{model.error}</div>}

        {!model.hasResponse && !model.error && (
          <div className="empty-state"><span>384</span><h3>dimensiones locales</h3><p>La primera búsqueda descarga el modelo cuantizado. Después podrás comparar ranking, threshold, top-k y fugas entre tenants.</p></div>
        )}

        {model.metrics && (
          <>
            <div className="metrics search-metrics" aria-label="Estadísticas de búsqueda">
              <article><span>Candidatos</span><strong>{model.metrics.candidates}</strong></article>
              <article><span>Resultados</span><strong>{model.metrics.results}</strong></article>
              <article><span>Cache hit / miss</span><strong>{model.metrics.cache}</strong></article>
              <article><span>Duración</span><strong>{model.metrics.duration}</strong><small>milisegundos</small></article>
            </div>
            <div className="model-strip"><span>{model.metrics.provider}</span><code>{model.metrics.model}</code><span>{model.metrics.dimensions}</span></div>

            {model.results.length === 0 ? <div className="empty-results">Ningún chunk superó el threshold actual.</div> : (
              <div className="result-list">
                {model.results.map((result) => (
                  <article className="result-card" key={result.chunkId}>
                    <div className="result-rank">{result.rank}</div>
                    <div className="result-card__content">
                      <header><div><strong>{result.documentTitle}</strong><span>{result.metadata}</span></div><div className="score">{result.score}</div></header>
                      <div className="score-track"><i style={{ width: result.scoreWidth }} /></div>
                      <pre>{result.text}</pre>
                      <footer><code>{result.chunkId}</code><span>{result.offsets}</span></footer>
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
