import type { FormEvent } from "react";

import type {
  GroundedAnswerLabPresenter,
  GroundedAnswerLabViewModel,
} from "../presenters/grounded-answer-lab-presenter";

type GroundedAnswerLabProps = {
  presenter: GroundedAnswerLabPresenter;
  model: GroundedAnswerLabViewModel;
};

function revealSource(citationId: string) {
  document.getElementById(`source-${citationId}`)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

export function GroundedAnswerLab({ presenter, model }: GroundedAnswerLabProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void presenter.submit();
  }

  return (
    <main className="workspace answer-workspace">
      <aside className="control-panel">
        <div className="section-heading">
          <span>Slice 04</span>
          <h1>Streaming SSE</h1>
          <p>Un run observable transmite retrieval, respuesta, validación y errores mediante eventos unidireccionales.</p>
        </div>

        <form onSubmit={submit}>
          <div className="field-group">
            <label htmlFor="answer-query">Pregunta</label>
            <textarea id="answer-query" value={model.query} onChange={(event) => presenter.setQuery(event.target.value)} rows={5} required />
          </div>
          <div className="field-group">
            <label htmlFor="answer-tenant">Tenant</label>
            <select id="answer-tenant" value={model.tenant} onChange={(event) => presenter.setTenant(event.target.value as typeof model.tenant)}>
              <option value="global">Global</option><option value="acme">Acme</option><option value="boreal">Boreal</option>
            </select>
            <div className="locked-filter">Aislamiento de tenant obligatorio</div>
          </div>
          <div className="field-group range-field">
            <div className="range-field__header"><label htmlFor="answer-top-k">Top-k</label><output>{model.topK}</output></div>
            <input id="answer-top-k" type="range" min="1" max="10" value={model.topK} onChange={(event) => presenter.setTopK(Number(event.target.value))} />
          </div>
          <div className="field-group range-field">
            <div className="range-field__header"><label htmlFor="answer-threshold">Threshold</label><output>{model.thresholdLabel}</output></div>
            <input id="answer-threshold" type="range" min="0" max="1" step="0.01" value={model.threshold} onChange={(event) => presenter.setThreshold(Number(event.target.value))} />
          </div>
          <button className="search-button" type="submit" disabled={model.isLoading}>{model.isLoading ? "Run en progreso…" : "Iniciar run con evidencia"}</button>
        </form>

        <div className="learning-note"><span>Guardrails</span><p>El backend fuerza output estructurado, bloquea fugas entre tenants y rechaza cualquier citation ID que no haya salido del retrieval.</p></div>
      </aside>

      <section className="inspector answer-inspector">
        <div className="inspector__header">
          <div><p className="overline">Grounding inspector</p><h2>{model.responseTitle}</h2></div>
          {model.isLoading && <span className="updating">{model.currentStage}</span>}
        </div>

        {model.error && <div className="error-box" role="alert">{model.error}</div>}
        {!model.answer && !model.error && !model.isLoading && (
          <div className="empty-state answer-empty-state"><span>[C]</span><h3>claims con evidencia</h3><p>La respuesta no es el artefacto final: cada claim debe sobrevivir una validación determinística contra los chunks recuperados.</p></div>
        )}
        {model.isLoading && !model.answer && (
          <article className="answer-card answer-card--streaming">
            <header><span>Respuesta en streaming</span><strong>{model.streamedAnswer.length} caracteres</strong></header>
            <p>{model.streamedAnswer || "Esperando que retrieval entregue contexto…"}{model.streamedAnswer && <i className="stream-cursor" aria-hidden="true" />}</p>
          </article>
        )}

        {model.trace.length > 0 && (
          <section className="trace-section" aria-label="Traza SSE del run">
            <div className="subsection-heading"><span>00</span><h3>Trace SSE</h3></div>
            <div className="trace-list">
              {model.trace.map((event) => (
                <article key={event.id} className={`trace-event trace-event--${event.typeClass}`}>
                  <span>{event.number}</span><div><strong>{event.label}</strong><small>{event.timestamp}</small></div><code>{event.type}</code>
                </article>
              ))}
            </div>
          </section>
        )}

        {model.answer && model.stats && (
          <>
            <article className={`answer-card ${model.answer.insufficientEvidence ? "answer-card--insufficient" : ""}`}>
              <header><span>{model.answer.status}</span><strong>{model.answer.claimsCount}</strong></header>
              <p>{model.answer.text}</p>
            </article>
            <div className="answer-stats">
              <span>{model.stats.retrievalChunks}</span><span>{model.stats.retrievalDuration}</span><span>{model.stats.generationDuration}</span><code>{model.stats.model}</code>
            </div>

            <section className="claims-section">
              <div className="subsection-heading"><span>01</span><h3>Claims y citas</h3></div>
              {model.claims.length === 0 ? <div className="empty-results">No hay afirmaciones sin evidencia.</div> : (
                <div className="claim-list">
                  {model.claims.map((claim) => (
                    <article className="claim-card" key={`${claim.number}-${claim.text}`}>
                      <span className="claim-number">{claim.number}</span>
                      <div><p>{claim.text}</p><footer>{claim.citationIds.map((citationId) => <button type="button" key={citationId} onClick={() => revealSource(citationId)}>↳ {citationId}</button>)}</footer></div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="sources-section">
              <div className="subsection-heading"><span>02</span><h3>Contexto entregado al modelo</h3></div>
              <div className="result-list">
                {model.sources.map((source) => (
                  <article className="result-card cited-source" id={`source-${source.chunkId}`} key={source.chunkId}>
                    <div className="result-rank">{source.rank}</div>
                    <div className="result-card__content">
                      <header><div><strong>{source.documentTitle}</strong><span>{source.metadata}</span></div><div className="score">{source.score}</div></header>
                      <pre>{source.text}</pre><footer><code>{source.chunkId}</code><span>{source.offsets}</span></footer>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
