import type {
  FailureLabPresenter,
  FailureLabViewModel,
} from "../presenters/FailureLabPresenter";

type FailureLabProps = {
  presenter: FailureLabPresenter;
  model: FailureLabViewModel;
};

export function FailureLab({ presenter, model }: FailureLabProps) {
  return (
    <main className="workspace search-workspace">
      <aside className="control-panel">
        <div className="section-heading">
          <span>Slice 07</span>
          <h1>Failure Lab</h1>
          <p>Compará una configuración baseline contra una variante que cambia una sola variable y observá qué casos se rompen.</p>
        </div>

        <div className="field-group">
          <label htmlFor="failure-experiment">Experimento</label>
          <select
            id="failure-experiment"
            value={model.selectedExperimentId ?? ""}
            disabled={model.isLoadingList || model.isRunning}
            onChange={(event) => presenter.selectExperiment(event.target.value)}
          >
            {model.experimentOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>

        {model.selected && (
          <>
            <p className="experiment-description">{model.selected.description}</p>

            <div className="field-group">
              <span className="field-label">Configuración lado a lado</span>
              <table className="config-table">
                <thead>
                  <tr><th>Variable</th><th>Baseline</th><th>Variante</th></tr>
                </thead>
                <tbody>
                  {model.selected.configRows.map((row) => (
                    <tr key={row.label} className={row.changed ? "config-table__changed" : ""}>
                      <td>{row.label}</td>
                      <td>{row.baseline}</td>
                      <td>{row.variant}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="search-button"
              type="button"
              disabled={model.isRunning}
              onClick={() => void presenter.runComparison()}
            >
              {model.isRunning ? "Comparando…" : "Ejecutar comparación"}
            </button>

            <div className="learning-note">
              <span>Qué aprendemos</span>
              <p>{model.selected.learning}</p>
            </div>
          </>
        )}

        <div className="learning-note">
          <span>Sin costo</span>
          <p>La comparación usa retrieval con embeddings locales. Nunca llama a Anthropic ni a ningún servicio pago.</p>
        </div>
      </aside>

      <section className="inspector search-inspector">
        <div className="inspector__header">
          <div>
            <p className="overline">Comparación controlada</p>
            <h2>{model.comparison ? model.comparison.experimentName : "Elegí un experimento y compará"}</h2>
          </div>
          {model.isRunning && <span className="updating">Ejecutando retrieval local</span>}
        </div>
        {model.error && <div className="error-box" role="alert">{model.error}</div>}

        {!model.comparison && !model.error && !model.isRunning && (
          <div className="empty-state">
            <span>1 var</span>
            <h3>una variable por experimento</h3>
            <p>El motor rechaza comparaciones que cambien más de una variable: así cada regresión tiene una capa responsable clara.</p>
          </div>
        )}

        {model.comparison && (
          <>
            <table className="metric-table" aria-label="Métricas lado a lado">
              <thead>
                <tr><th>Métrica</th><th>Baseline</th><th>Variante</th><th>Delta</th></tr>
              </thead>
              <tbody>
                {model.comparison.metricRows.map((row) => (
                  <tr key={row.metric}>
                    <td>{row.label}</td>
                    <td>{row.baselineRate}</td>
                    <td>{row.variantRate}</td>
                    <td className={`delta delta--${row.deltaTone}`}>{row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="model-strip">
              <span>{model.comparison.unchangedLabel}</span>
              <span>Ejecutado {model.comparison.generatedAtLabel}</span>
            </div>

            {model.comparison.degradedCases.length > 0 && (
              <div className="case-group">
                <h3 className="case-group__title case-group__title--bad">Casos que empeoraron</h3>
                <div className="result-list">
                  {model.comparison.degradedCases.map((change) => (
                    <article className="result-card" key={change.caseId}>
                      <div className="result-card__content">
                        <header>
                          <div><strong>{change.name}</strong><span>{change.caseId}</span></div>
                          <div className="status-change">{change.baselineStatus} → {change.variantStatus}</div>
                        </header>
                        <footer><code>{change.detail}</code></footer>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {model.comparison.improvedCases.length > 0 && (
              <div className="case-group">
                <h3 className="case-group__title case-group__title--good">Casos que mejoraron</h3>
                <div className="result-list">
                  {model.comparison.improvedCases.map((change) => (
                    <article className="result-card" key={change.caseId}>
                      <div className="result-card__content">
                        <header>
                          <div><strong>{change.name}</strong><span>{change.caseId}</span></div>
                          <div className="status-change">{change.baselineStatus} → {change.variantStatus}</div>
                        </header>
                        <footer><code>{change.detail}</code></footer>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="failure-explanation">
              <h3>Fallo observado</h3>
              <p>{model.comparison.observedFailure}</p>
              <h3>Capa responsable</h3>
              <p><strong>{model.comparison.responsibleLayerLabel}</strong> — la corrección vive en esa capa, no en el prompt ni en los embeddings.</p>
              <h3>Corrección sugerida</h3>
              <p>{model.comparison.suggestedFix}</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
