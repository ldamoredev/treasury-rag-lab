import {
  GroundedAnswerResponseSchema,
  RunCreatedResponseSchema,
  RunEventSchema,
  type GroundedAnswerResponse,
  type RunEvent,
  type RunEventType,
  type Tenant,
} from "@treasury-rag/contracts";
import { useEffect, useRef, useState, type FormEvent } from "react";

const RUN_EVENT_TYPES: RunEventType[] = [
  "run.started",
  "retrieval.started",
  "retrieval.completed",
  "generation.started",
  "answer.delta",
  "answer.completed",
  "evaluation.completed",
  "run.completed",
  "run.failed",
];

const EVENT_LABELS: Record<RunEventType, string> = {
  "run.started": "Run iniciado",
  "retrieval.started": "Retrieval iniciado",
  "retrieval.completed": "Retrieval completo",
  "generation.started": "Generación iniciada",
  "answer.delta": "Delta recibido",
  "answer.completed": "Respuesta completa",
  "evaluation.completed": "Evaluación completa",
  "run.completed": "Run completo",
  "run.failed": "Run fallido",
};

function readApiError(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error?: { message?: string } }).error;
    if (error?.message) {
      return error.message;
    }
  }

  return `No se pudo generar la respuesta (${status})`;
}

export function GroundedAnswerLab() {
  const [query, setQuery] = useState("¿Un pago parcial cancela la factura?");
  const [tenant, setTenant] = useState<Tenant>("acme");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.7);
  const [response, setResponse] = useState<GroundedAnswerResponse>();
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [trace, setTrace] = useState<RunEvent[]>([]);
  const [currentStage, setCurrentStage] = useState("Esperando pregunta");
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => () => eventSourceRef.current?.close(), []);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    eventSourceRef.current?.close();
    setIsLoading(true);
    setError(undefined);
    setResponse(undefined);
    setStreamedAnswer("");
    setTrace([]);
    setCurrentStage("Creando run…");

    try {
      const request = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          tenant,
          config: {
            chunking: {
              strategy: "characters",
              chunkSize: 300,
              overlap: 80,
            },
            topK,
            threshold,
            tenantFilterEnabled: true,
          },
        }),
      });
      const body: unknown = await request.json();

      if (!request.ok) {
        throw new Error(readApiError(body, request.status));
      }

      const { runId } = RunCreatedResponseSchema.parse(body);
      const eventSource = new EventSource(`/api/runs/${runId}/events`);
      eventSourceRef.current = eventSource;

      const handleRunEvent = (rawEvent: Event) => {
        try {
          const message = rawEvent as MessageEvent<string>;
          const runEvent = RunEventSchema.parse(JSON.parse(message.data));
          setTrace((current) => [...current, runEvent]);

          switch (runEvent.type) {
            case "run.started":
              setCurrentStage("Run conectado");
              break;
            case "retrieval.started":
              setCurrentStage("Buscando evidencia…");
              break;
            case "retrieval.completed":
              setCurrentStage(
                `${runEvent.data.sources.length} chunks recuperados`,
              );
              break;
            case "generation.started":
              setCurrentStage(`Generando con ${runEvent.data.model}…`);
              break;
            case "answer.delta":
              setCurrentStage("Transmitiendo respuesta…");
              setStreamedAnswer((current) => current + runEvent.data.delta);
              break;
            case "answer.completed":
              setCurrentStage("Validando grounding…");
              setStreamedAnswer(runEvent.data.answer);
              break;
            case "evaluation.completed":
              setCurrentStage("Evaluación determinística completa");
              break;
            case "run.completed":
              setResponse(
                GroundedAnswerResponseSchema.parse(runEvent.data.response),
              );
              setCurrentStage("Run completo");
              setIsLoading(false);
              eventSource.close();
              break;
            case "run.failed":
              setError(runEvent.data.message);
              setCurrentStage("Run fallido");
              setIsLoading(false);
              eventSource.close();
              break;
          }
        } catch (streamError) {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Se recibió un evento SSE inválido",
          );
          setCurrentStage("Evento inválido");
          setIsLoading(false);
          eventSource.close();
        }
      };

      for (const eventType of RUN_EVENT_TYPES) {
        eventSource.addEventListener(eventType, handleRunEvent);
      }

      eventSource.onerror = () => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          setCurrentStage("Reconectando SSE…");
        }
      };
    } catch (answerError) {
      setError(
        answerError instanceof Error
          ? answerError.message
          : "La generación grounded falló",
      );
      setIsLoading(false);
    }
  }

  function revealSource(citationId: string) {
    document.getElementById(`source-${citationId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <main className="workspace answer-workspace">
      <aside className="control-panel">
        <div className="section-heading">
          <span>Slice 04</span>
          <h1>Streaming SSE</h1>
          <p>
            Un run observable transmite retrieval, respuesta, validación y
            errores mediante eventos unidireccionales.
          </p>
        </div>

        <form onSubmit={(event) => void submitQuestion(event)}>
          <div className="field-group">
            <label htmlFor="answer-query">Pregunta</label>
            <textarea
              id="answer-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={5}
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="answer-tenant">Tenant</label>
            <select
              id="answer-tenant"
              value={tenant}
              onChange={(event) => setTenant(event.target.value as Tenant)}
            >
              <option value="global">Global</option>
              <option value="acme">Acme</option>
              <option value="boreal">Boreal</option>
            </select>
            <div className="locked-filter">Aislamiento de tenant obligatorio</div>
          </div>

          <div className="field-group range-field">
            <div className="range-field__header">
              <label htmlFor="answer-top-k">Top-k</label>
              <output>{topK}</output>
            </div>
            <input
              id="answer-top-k"
              type="range"
              min="1"
              max="10"
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
            />
          </div>

          <div className="field-group range-field">
            <div className="range-field__header">
              <label htmlFor="answer-threshold">Threshold</label>
              <output>{threshold.toFixed(2)}</output>
            </div>
            <input
              id="answer-threshold"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
          </div>

          <button className="search-button" type="submit" disabled={isLoading}>
            {isLoading ? "Run en progreso…" : "Iniciar run con evidencia"}
          </button>
        </form>

        <div className="learning-note">
          <span>Guardrails</span>
          <p>
            El backend fuerza output estructurado, bloquea fugas entre tenants y
            rechaza cualquier citation ID que no haya salido del retrieval.
          </p>
        </div>
      </aside>

      <section className="inspector answer-inspector">
        <div className="inspector__header">
          <div>
            <p className="overline">Grounding inspector</p>
            <h2>{response ? `Respuesta para ${response.tenant}` : "Preguntale al corpus"}</h2>
          </div>
          {isLoading && <span className="updating">{currentStage}</span>}
        </div>

        {error && <div className="error-box" role="alert">{error}</div>}

        {!response && !error && !isLoading && (
          <div className="empty-state answer-empty-state">
            <span>[C]</span>
            <h3>claims con evidencia</h3>
            <p>
              La respuesta no es el artefacto final: cada claim debe sobrevivir
              una validación determinística contra los chunks recuperados.
            </p>
          </div>
        )}

        {isLoading && !response && (
          <article className="answer-card answer-card--streaming">
            <header>
              <span>Respuesta en streaming</span>
              <strong>{streamedAnswer.length} caracteres</strong>
            </header>
            <p>
              {streamedAnswer || "Esperando que retrieval entregue contexto…"}
              {streamedAnswer && <i className="stream-cursor" aria-hidden="true" />}
            </p>
          </article>
        )}

        {trace.length > 0 && (
          <section className="trace-section" aria-label="Traza SSE del run">
            <div className="subsection-heading">
              <span>00</span>
              <h3>Trace SSE</h3>
            </div>
            <div className="trace-list">
              {trace.map((runEvent) => (
                <article key={runEvent.id} className={`trace-event trace-event--${runEvent.type.replaceAll(".", "-")}`}>
                  <span>{String(runEvent.id).padStart(2, "0")}</span>
                  <div>
                    <strong>{EVENT_LABELS[runEvent.type]}</strong>
                    <small>{new Date(runEvent.timestamp).toLocaleTimeString()}</small>
                  </div>
                  <code>{runEvent.type}</code>
                </article>
              ))}
            </div>
          </section>
        )}

        {response && (
          <>
            <article className={`answer-card ${response.insufficientEvidence ? "answer-card--insufficient" : ""}`}>
              <header>
                <span>{response.insufficientEvidence ? "Evidencia insuficiente" : "Respuesta grounded"}</span>
                <strong>{response.claims.length} claims</strong>
              </header>
              <p>{response.answer}</p>
            </article>

            <div className="answer-stats">
              <span>{response.retrieval.returnedChunks} chunks recuperados</span>
              <span>{Math.round(response.retrieval.durationMs)} ms retrieval</span>
              <span>
                {response.generation.attempted
                  ? `${Math.round(response.generation.durationMs)} ms generación`
                  : "generación omitida"}
              </span>
              <code>
                {response.generation.attempted
                  ? `${response.generation.provider}/${response.generation.model}`
                  : response.retrieval.model}
              </code>
            </div>

            <section className="claims-section">
              <div className="subsection-heading">
                <span>01</span>
                <h3>Claims y citas</h3>
              </div>
              {response.claims.length === 0 ? (
                <div className="empty-results">No hay afirmaciones sin evidencia.</div>
              ) : (
                <div className="claim-list">
                  {response.claims.map((claim, index) => (
                    <article className="claim-card" key={`${index}-${claim.text}`}>
                      <span className="claim-number">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <p>{claim.text}</p>
                        <footer>
                          {claim.citationIds.map((citationId) => (
                            <button
                              type="button"
                              key={citationId}
                              onClick={() => revealSource(citationId)}
                            >
                              ↳ {citationId}
                            </button>
                          ))}
                        </footer>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="sources-section">
              <div className="subsection-heading">
                <span>02</span>
                <h3>Contexto entregado al modelo</h3>
              </div>
              <div className="result-list">
                {response.sources.map((source) => (
                  <article
                    className="result-card cited-source"
                    id={`source-${source.chunkId}`}
                    key={source.chunkId}
                  >
                    <div className="result-rank">#{source.rank}</div>
                    <div className="result-card__content">
                      <header>
                        <div>
                          <strong>{source.documentTitle}</strong>
                          <span>{source.tenant} · v{source.version} · {source.effectiveFrom}</span>
                        </div>
                        <div className="score">{source.score.toFixed(4)}</div>
                      </header>
                      <pre>{source.text}</pre>
                      <footer>
                        <code>{source.chunkId}</code>
                        <span>{source.startOffset}–{source.endOffset}</span>
                      </footer>
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
