import type {
  GroundedAnswerLabPresenter,
  GroundedAnswerLabViewModel,
  InspectorTab,
} from "../../presenters/GroundedAnswerLabPresenter";

type GroundedAnswerInspectorProps = {
  presenter: GroundedAnswerLabPresenter;
  model: GroundedAnswerLabViewModel;
};

export function GroundedAnswerInspector({
  presenter,
  model,
}: GroundedAnswerInspectorProps) {
  return (
    <aside className="evidence-inspector" aria-label="Inspector del run">
      <header className="evidence-inspector__header">
        <div>
          <p className="overline">Por qué contestó esto</p>
          <h2>{model.responseTitle}</h2>
        </div>
        <span className={model.isLoading ? "run-state run-state--live" : "run-state"}>
          {model.isLoading ? "Live" : "Ready"}
        </span>
      </header>

      <nav className="inspector-tabs" role="tablist" aria-label="Detalles del run">
        {model.inspectorTabs.map((tab) => (
          <button
            id={`inspector-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={model.activeInspectorTab === tab.id}
            aria-controls="inspector-tabpanel"
            className={model.activeInspectorTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => presenter.selectInspectorTab(tab.id)}
          >
            {tab.label}
            {tab.badge && <span>{tab.badge}</span>}
          </button>
        ))}
      </nav>

      <div
        id="inspector-tabpanel"
        className="inspector-tabpanel"
        role="tabpanel"
        aria-labelledby={`inspector-tab-${model.activeInspectorTab}`}
      >
        {renderTab(model.activeInspectorTab, presenter, model)}
      </div>
    </aside>
  );
}

function renderTab(
  tab: InspectorTab,
  presenter: GroundedAnswerLabPresenter,
  model: GroundedAnswerLabViewModel,
) {
  switch (tab) {
    case "retrieval":
      return <RetrievalTab model={model} />;
    case "context":
      return <ContextTab model={model} />;
    case "trace":
      return <TraceTab model={model} />;
    case "metrics":
      return <MetricsTab model={model} />;
    case "settings":
      return <SettingsTab presenter={presenter} model={model} />;
  }
}

function TabIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <header className="tab-intro">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </header>
  );
}

function InspectorEmpty({ children }: { children: string }) {
  return <div className="inspector-empty">{children}</div>;
}

function RetrievalTab({ model }: { model: GroundedAnswerLabViewModel }) {
  return (
    <>
      <TabIntro
        eyebrow="01 · Ranking"
        title="Evidencia recuperada"
        copy="Los chunks se ordenan por similitud coseno. El score explica qué tan cerca quedó cada texto de la pregunta."
      />
      {model.sources.length === 0 ? (
        <InspectorEmpty>Ejecutá una pregunta para ver el ranking.</InspectorEmpty>
      ) : (
        <div className="retrieval-list">
          {model.sources.map((source) => (
            <article className="retrieval-card" key={source.chunkId}>
              <div className="retrieval-card__rank">{source.rank}</div>
              <div>
                <header>
                  <div>
                    <strong>{source.documentTitle}</strong>
                    <span>{source.metadata}</span>
                  </div>
                  <b>{source.score}</b>
                </header>
                <p>{source.text}</p>
                <footer>
                  <code>{source.chunkId}</code>
                  <span>{source.offsets}</span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function ContextTab({ model }: { model: GroundedAnswerLabViewModel }) {
  return (
    <>
      <TabIntro
        eyebrow="02 · Prompt context"
        title="Lo que leyó el modelo"
        copy="Este es el contexto exacto, en orden, que acompañó a la pregunta durante la generación."
      />
      {model.sources.length === 0 ? (
        <InspectorEmpty>Todavía no se construyó contexto.</InspectorEmpty>
      ) : (
        <div className="context-list">
          {model.sources.map((source) => (
            <article id={`source-${source.chunkId}`} className="context-card" key={source.chunkId} tabIndex={-1}>
              <header>
                <span>Context {source.rank}</span>
                <strong>{source.score}</strong>
              </header>
              <pre>{source.text}</pre>
              <footer>
                <code>{source.chunkId}</code>
                <span>{source.documentTitle}</span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function TraceTab({ model }: { model: GroundedAnswerLabViewModel }) {
  return (
    <>
      <TabIntro
        eyebrow="03 · SSE"
        title="Traza del run"
        copy="Cada transición enviada por el backend queda visible en el mismo orden en que llegó."
      />
      {model.trace.length === 0 ? (
        <InspectorEmpty>Los eventos aparecerán mientras corre la pregunta.</InspectorEmpty>
      ) : (
        <div className="trace-list trace-list--inspector">
          {model.trace.map((event) => (
            <article key={event.id} className={`trace-event trace-event--${event.typeClass}`}>
              <span>{event.number}</span>
              <div>
                <strong>{event.label}</strong>
                <small>{event.timestamp}</small>
              </div>
              <code>{event.type}</code>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function MetricsTab({ model }: { model: GroundedAnswerLabViewModel }) {
  return (
    <>
      <TabIntro
        eyebrow="04 · Observabilidad"
        title="Métricas y guardrails"
        copy="Separá la calidad del retrieval, la seguridad y el costo operativo de la respuesta final."
      />

      <div className="metric-grid">
        <Metric label="Candidatos" value={model.retrieval ? String(model.retrieval.candidateChunks) : "—"} />
        <Metric label="Retornados" value={model.retrieval ? String(model.retrieval.returnedChunks) : "—"} />
        <Metric label="Retrieval" value={model.retrieval?.duration ?? "—"} />
        <Metric label="Run total" value={model.runSummary?.duration ?? "—"} />
      </div>

      <section className="guardrail-list">
        <h4>Evaluación determinística</h4>
        <Guardrail
          label="Citation IDs válidos"
          value={model.evaluation ? model.evaluation.citationValidity : undefined}
        />
        <Guardrail
          label="Sin fuga entre tenants"
          value={model.evaluation ? !model.evaluation.tenantLeakage : undefined}
        />
      </section>

      {model.retrieval && (
        <dl className="technical-metrics">
          <div><dt>Embedding</dt><dd>{model.retrieval.provider} / {model.retrieval.model}</dd></div>
          <div><dt>Generación</dt><dd>{model.stats?.generationDuration ?? "pendiente"}</dd></div>
          <div><dt>Modelo answer</dt><dd>{model.stats?.model ?? "—"}</dd></div>
          <div><dt>Dimensiones</dt><dd>{model.retrieval.dimensions}</dd></div>
          <div><dt>Contexto</dt><dd>{model.retrieval.contextCharacters} caracteres</dd></div>
          <div><dt>Cache</dt><dd>{model.retrieval.cache}</dd></div>
          <div><dt>Eventos</dt><dd>{model.runSummary?.eventCount ?? 0}</dd></div>
          <div><dt>Deltas</dt><dd>{model.runSummary?.deltaCount ?? 0}</dd></div>
        </dl>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function Guardrail({ label, value }: { label: string; value: boolean | undefined }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={value === false ? "guardrail-failed" : ""}>
        {value === undefined ? "Pendiente" : value ? "Pass" : "Fail"}
      </strong>
    </div>
  );
}

function SettingsTab({
  presenter,
  model,
}: GroundedAnswerInspectorProps) {
  return (
    <>
      <TabIntro
        eyebrow="05 · Configuración"
        title="Parámetros del próximo run"
        copy="Estos valores viajan en el comando de ejecución; el backend conserva los guardrails obligatorios."
      />

      <div className="settings-form">
        <fieldset>
          <legend>Chunking strategy</legend>
          <div className="segmented-control">
            <button
              type="button"
              className={model.chunkingStrategy === "characters" ? "active" : ""}
              onClick={() => presenter.setChunkingStrategy("characters")}
            >
              Characters
            </button>
            <button
              type="button"
              className={model.chunkingStrategy === "headings" ? "active" : ""}
              onClick={() => presenter.setChunkingStrategy("headings")}
            >
              Headings
            </button>
          </div>
        </fieldset>

        {model.chunkingStrategy === "characters" ? (
          <div className="settings-grid">
            <NumberSetting label="Chunk size" value={model.chunkSize} min={1} max={5000} onChange={(value) => presenter.setChunkSize(value)} />
            <NumberSetting label="Overlap" value={model.overlap} min={0} max={model.chunkSize - 1} onChange={(value) => presenter.setOverlap(value)} />
          </div>
        ) : (
          <NumberSetting label="Max chunk size" value={model.maxChunkSize} min={1} max={5000} onChange={(value) => presenter.setMaxChunkSize(value)} />
        )}

        <div className="settings-grid">
          <NumberSetting label="Top-k" value={model.topK} min={1} max={20} onChange={(value) => presenter.setTopK(value)} />
          <label className="setting-field">
            <span>Threshold</span>
            <div><input type="range" min={-1} max={1} step={0.01} value={model.threshold} onChange={(event) => presenter.setThreshold(Number(event.target.value))} /><output>{model.thresholdLabel}</output></div>
          </label>
        </div>

        <div className="locked-guardrail">
          <span aria-hidden="true">◆</span>
          <div><strong>Tenant isolation</strong><small>Siempre activo; no puede deshabilitarse desde la UI.</small></div>
          <b>Locked</b>
        </div>
      </div>
    </>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="setting-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
