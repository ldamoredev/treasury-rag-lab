import { useMemo, useState } from "react";

import { HttpTreasuryRagGateway } from "./core/infrastructure/http/http-treasury-rag-gateway";
import { ChunkingLabPresenter } from "./presenters/chunking-lab-presenter";
import { GroundedAnswerLabPresenter } from "./presenters/grounded-answer-lab-presenter";
import { SemanticSearchLabPresenter } from "./presenters/semantic-search-lab-presenter";
import { ChunkingLab } from "./ui/ChunkingLab";
import { GroundedAnswerLab } from "./ui/GroundedAnswerLab";
import { SearchLab } from "./ui/SearchLab";
import { usePresenter } from "./ui/use-presenter";

type LabMode = "chunking" | "search" | "answer";

export function App() {
  const [labMode, setLabMode] = useState<LabMode>("chunking");
  const gateway = useMemo(() => new HttpTreasuryRagGateway(), []);
  const chunking = usePresenter(
    (onChange) => new ChunkingLabPresenter(onChange, gateway),
    [gateway],
    labMode === "chunking",
  );
  const search = usePresenter(
    (onChange) => new SemanticSearchLabPresenter(onChange, gateway),
    [gateway],
    labMode === "search",
  );
  const groundedAnswer = usePresenter(
    (onChange) => new GroundedAnswerLabPresenter(onChange, gateway),
    [gateway],
    labMode === "answer",
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">TR</span>
          <div><p>Treasury RAG Lab</p><span>Laboratorio de evidencia</span></div>
        </div>

        <nav className="lab-nav" aria-label="Secciones del laboratorio">
          <button type="button" className={labMode === "chunking" ? "active" : ""} onClick={() => setLabMode("chunking")}>Chunking</button>
          <button type="button" className={labMode === "search" ? "active" : ""} onClick={() => setLabMode("search")}>Semantic search</button>
          <button type="button" className={labMode === "answer" ? "active" : ""} onClick={() => setLabMode("answer")}>Grounded answer</button>
        </nav>

        <div className={`connection ${chunking.model.connectionFailed ? "connection--error" : ""}`}>
          <span className="connection__dot" />
          {chunking.model.connectionLabel}
        </div>
      </header>

      {labMode === "chunking" && <ChunkingLab presenter={chunking} model={chunking.model} />}
      {labMode === "search" && <SearchLab presenter={search} model={search.model} />}
      {labMode === "answer" && <GroundedAnswerLab presenter={groundedAnswer} model={groundedAnswer.model} />}
    </div>
  );
}
