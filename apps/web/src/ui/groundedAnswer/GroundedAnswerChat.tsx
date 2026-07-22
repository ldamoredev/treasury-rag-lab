import type { FormEvent } from "react";

import type {
  GroundedAnswerLabPresenter,
  GroundedAnswerLabViewModel,
} from "../../presenters/GroundedAnswerLabPresenter";

type GroundedAnswerChatProps = {
  presenter: GroundedAnswerLabPresenter;
  model: GroundedAnswerLabViewModel;
  onRevealCitation: (citationId: string) => void;
};

export function GroundedAnswerChat({
  presenter,
  model,
  onRevealCitation,
}: GroundedAnswerChatProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void presenter.submit();
  }

  return (
    <section className="chat-panel" aria-label="Conversación grounded">
      <header className="chat-panel__header">
        <div>
          <p className="overline">Slice 05 · UI workbench</p>
          <h1>Preguntale a tesorería</h1>
        </div>
        <span className="tenant-pill">{model.tenant}</span>
      </header>

      <div className="chat-thread" aria-live="polite">
        {!model.submittedQuestion && (
          <div className="chat-welcome">
            <span aria-hidden="true">TR</span>
            <h2>Una respuesta no alcanza.</h2>
            <p>
              Cada afirmación debe poder rastrearse hasta evidencia recuperada,
              dentro del tenant correcto y con el run completo a la vista.
            </p>
            <div className="prompt-suggestion">
              Probá: “¿Un pago parcial cancela la factura?”
            </div>
          </div>
        )}

        {model.submittedQuestion && (
          <article className="chat-message chat-message--user">
            <div className="chat-avatar">NB</div>
            <div>
              <header>
                <strong>Vos</strong>
                <span>{model.submittedQuestion.tenant}</span>
              </header>
              <p>{model.submittedQuestion.text}</p>
            </div>
          </article>
        )}

        {model.submittedQuestion && (
          <article className="chat-message chat-message--assistant">
            <div className="chat-avatar">TR</div>
            <div className="assistant-response">
              <header>
                <strong>Treasury RAG</strong>
                <span className={model.isLoading ? "status-live" : ""}>
                  {model.currentStage}
                </span>
              </header>

              {model.error && (
                <div className="error-box" role="alert">{model.error}</div>
              )}

              {!model.error && model.isLoading && (
                <p className="streamed-answer">
                  {model.streamedAnswer || "Buscando evidencia antes de responder…"}
                  {model.streamedAnswer && (
                    <i className="stream-cursor" aria-hidden="true" />
                  )}
                </p>
              )}

              {!model.error && model.answer && (
                <>
                  <div className={`answer-status ${model.answer.insufficientEvidence ? "answer-status--warning" : ""}`}>
                    <span>{model.answer.status}</span>
                    <small>{model.answer.claimsCount}</small>
                  </div>
                  <p className="final-answer">{model.answer.text}</p>

                  {model.claims.length > 0 && (
                    <ol className="inline-claims">
                      {model.claims.map((claim) => (
                        <li key={`${claim.number}-${claim.text}`}>
                          <p>{claim.text}</p>
                          <div>
                            {claim.citationIds.map((citationId) => (
                              <button
                                type="button"
                                key={citationId}
                                onClick={() => onRevealCitation(citationId)}
                                title="Ver el chunk exacto en Context"
                              >
                                [{citationId}]
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          </article>
        )}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <label htmlFor="answer-query">Tu pregunta</label>
        <textarea
          id="answer-query"
          value={model.query}
          onChange={(event) => presenter.setQuery(event.target.value)}
          placeholder="Preguntá sobre pagos, facturas o políticas…"
          rows={3}
          required
        />
        <footer>
          <div className="composer-tenant">
            <span>Tenant</span>
            <select
              aria-label="Tenant de la pregunta"
              value={model.tenant}
              onChange={(event) =>
                presenter.setTenant(event.target.value as typeof model.tenant)
              }
            >
              <option value="global">Global</option>
              <option value="acme">Acme</option>
              <option value="boreal">Boreal</option>
            </select>
          </div>
          <button type="submit" disabled={model.isLoading}>
            {model.isLoading ? "Ejecutando…" : "Preguntar"}
            <span aria-hidden="true">↗</span>
          </button>
        </footer>
      </form>
    </section>
  );
}
