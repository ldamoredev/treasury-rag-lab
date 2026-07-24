import type {
  ChunkingLabPresenter,
  ChunkingLabViewModel,
} from "../presenters/ChunkingLabPresenter";

type ChunkingLabProps = {
  presenter: ChunkingLabPresenter;
  model: ChunkingLabViewModel;
};

export function ChunkingLab({ presenter, model }: ChunkingLabProps) {
  return (
    <main className="workspace">
      <aside className="control-panel">
        <div className="section-heading">
          <span>Slice 01</span>
          <h1>Chunking visible</h1>
          <p>Cambiá una variable y observá cómo se transforma la evidencia.</p>
        </div>

        {model.documentsError ? (
          <div className="error-box" role="alert">{model.documentsError}</div>
        ) : (
          <>
            <div className="field-group">
              <label htmlFor="document">Documento</label>
              <select
                id="document"
                value={model.selectedDocumentId}
                onChange={(event) => presenter.selectDocument(event.target.value)}
              >
                {model.documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
              {model.selectedDocument && (
                <div className="document-meta">
                  <span>{model.selectedDocument.tenant}</span>
                  <span>{model.selectedDocument.version}</span>
                  <span>{model.selectedDocument.effectiveFrom}</span>
                </div>
              )}
            </div>

            <div className="field-group">
              <span className="field-label">Estrategia</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={model.strategy === "characters" ? "active" : ""}
                  onClick={() => presenter.setStrategy("characters")}
                >
                  Caracteres
                </button>
                <button
                  type="button"
                  className={model.strategy === "headings" ? "active" : ""}
                  onClick={() => presenter.setStrategy("headings")}
                >
                  Headings
                </button>
                <button
                  type="button"
                  className={model.strategy === "tokens" ? "active" : ""}
                  onClick={() => presenter.setStrategy("tokens")}
                >
                  Tokens
                </button>
              </div>
            </div>

            {model.strategy === "characters" ? (
              <>
                <div className="field-group range-field">
                  <div className="range-field__header">
                    <label htmlFor="chunk-size">Chunk size</label>
                    <input
                      aria-label="Valor de chunk size"
                      type="number"
                      min="1"
                      max="5000"
                      value={model.chunkSize}
                      onChange={(event) => presenter.setChunkSize(Number(event.target.value))}
                    />
                  </div>
                  <input
                    id="chunk-size"
                    type="range"
                    min="100"
                    max="1200"
                    step="50"
                    value={Math.min(1200, Math.max(100, model.chunkSize))}
                    onChange={(event) => presenter.setChunkSize(Number(event.target.value))}
                  />
                  <div className="range-labels"><span>100</span><span>1200</span></div>
                </div>

                <div className="field-group range-field">
                  <div className="range-field__header">
                    <label htmlFor="overlap">Overlap</label>
                    <input
                      aria-label="Valor de overlap"
                      type="number"
                      min="0"
                      max={model.chunkSize - 1}
                      value={model.overlap}
                      onChange={(event) => presenter.setOverlap(Number(event.target.value))}
                    />
                  </div>
                  <input
                    id="overlap"
                    type="range"
                    min="0"
                    max={model.overlapRangeMaximum}
                    step="10"
                    value={Math.min(model.overlap, model.overlapRangeMaximum)}
                    onChange={(event) => presenter.setOverlap(Number(event.target.value))}
                  />
                  <div className="range-labels"><span>0</span><span>{model.overlapRangeMaximum}</span></div>
                </div>
              </>
            ) : model.strategy === "headings" ? (
              <div className="field-group range-field">
                <div className="range-field__header">
                  <label htmlFor="max-chunk-size">Máximo por chunk</label>
                  <input
                    aria-label="Valor máximo por chunk"
                    type="number"
                    min="1"
                    max="5000"
                    value={model.maxChunkSize}
                    onChange={(event) => presenter.setMaxChunkSize(Number(event.target.value))}
                  />
                </div>
                <input
                  id="max-chunk-size"
                  type="range"
                  min="100"
                  max="1600"
                  step="50"
                  value={Math.min(1600, Math.max(100, model.maxChunkSize))}
                  onChange={(event) => presenter.setMaxChunkSize(Number(event.target.value))}
                />
                <div className="range-labels"><span>100</span><span>1600</span></div>
              </div>
            ) : (
              <>
                <div className="field-group range-field">
                  <div className="range-field__header">
                    <label htmlFor="max-tokens">Máximo de tokens</label>
                    <input
                      aria-label="Valor máximo de tokens"
                      type="number"
                      min="4"
                      max="1024"
                      value={model.maxTokens}
                      onChange={(event) => presenter.setMaxTokens(Number(event.target.value))}
                    />
                  </div>
                  <input
                    id="max-tokens"
                    type="range"
                    min="16"
                    max="512"
                    step="8"
                    value={Math.min(512, Math.max(16, model.maxTokens))}
                    onChange={(event) => presenter.setMaxTokens(Number(event.target.value))}
                  />
                  <div className="range-labels"><span>16</span><span>512</span></div>
                </div>

                <div className="field-group range-field">
                  <div className="range-field__header">
                    <label htmlFor="overlap-tokens">Overlap en tokens</label>
                    <input
                      aria-label="Valor de overlap en tokens"
                      type="number"
                      min="0"
                      max={model.maxTokens - 1}
                      value={model.overlapTokens}
                      onChange={(event) => presenter.setOverlapTokens(Number(event.target.value))}
                    />
                  </div>
                  <input
                    id="overlap-tokens"
                    type="range"
                    min="0"
                    max={model.overlapTokensRangeMaximum}
                    step="4"
                    value={Math.min(model.overlapTokens, model.overlapTokensRangeMaximum)}
                    onChange={(event) => presenter.setOverlapTokens(Number(event.target.value))}
                  />
                  <div className="range-labels"><span>0</span><span>{model.overlapTokensRangeMaximum}</span></div>
                </div>
              </>
            )}

            <div className="learning-note">
              <span>Qué mirar</span>
              <p>
                El amarillo señala texto duplicado por overlap. Prestá atención a
                títulos aislados, reglas cortadas y chunks con demasiado contexto.
                El prefijo contextual se embebe pero nunca se cita: el texto de la
                cita sigue siendo el del documento.
              </p>
            </div>
          </>
        )}
      </aside>

      <section className="inspector">
        <div className="inspector__header">
          <div>
            <p className="overline">Inspector de fragmentación</p>
            <h2>{model.previewTitle}</h2>
          </div>
          {model.isLoading && <span className="updating">Actualizando</span>}
        </div>

        {model.previewError && <div className="error-box" role="alert">{model.previewError}</div>}

        {model.metrics && (
          <>
            <div className="metrics" aria-label="Estadísticas de chunking">
              <article><span>Chunks</span><strong>{model.metrics.chunks}</strong></article>
              <article><span>Documento</span><strong>{model.metrics.documentCharacters}</strong><small>{model.metrics.documentTokens} tokens</small></article>
              <article className={model.metrics.duplicatedCharacters > 0 ? "metric--warning" : ""}>
                <span>Duplicados</span><strong>{model.metrics.duplicatedCharacters}</strong><small>por overlap</small>
              </article>
              <article><span>Promedio</span><strong>{model.metrics.averageCharacters}</strong><small>{model.metrics.averageTokens} tokens</small></article>
              <article><span>Máximo</span><strong>{model.metrics.maximumTokens}</strong><small>tokens por chunk</small></article>
              <article className={model.metrics.contextualTokens > 0 ? "metric--warning" : ""}>
                <span>Costo extra</span><strong>{model.metrics.contextualTokens}</strong><small>tokens embebidos de más</small>
              </article>
            </div>

            <p className="overline">Contextualizador: {model.contextualizerLabel}</p>

            <div className={`chunk-list ${model.isLoading ? "chunk-list--updating" : ""}`}>
              {model.chunks.map((chunk) => (
                <article className="chunk-card" key={chunk.id}>
                  <div className="chunk-card__rail"><span>{chunk.number}</span><i /></div>
                  <div className="chunk-card__body">
                    <header>
                      <div><strong>Chunk {chunk.index}</strong><span>{chunk.offsets}</span></div>
                      <span className="length-pill">{chunk.length} · {chunk.tokens}</span>
                    </header>
                    {chunk.contextualPrefix && (
                      <p className="contextual-prefix" title="Se embebe con el chunk pero no forma parte del documento y nunca se cita">
                        {chunk.contextualPrefix}
                      </p>
                    )}
                    <pre>
                      {chunk.overlapText && <mark title={`${chunk.overlapText.length} caracteres repetidos`}>{chunk.overlapText}</mark>}
                      {chunk.remainingText}
                    </pre>
                    <footer><code>{chunk.id}</code><span>{chunk.metadata}</span></footer>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
