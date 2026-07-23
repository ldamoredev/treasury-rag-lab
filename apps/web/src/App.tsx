import { useMemo, useState } from "react";

import { HttpTreasuryRagGateway } from "./core/infrastructure/http/HttpTreasuryRagGateway";
import { ChunkingLabPresenter } from "./presenters/ChunkingLabPresenter";
import { FailureLabPresenter } from "./presenters/FailureLabPresenter";
import { GroundedAnswerLabPresenter } from "./presenters/GroundedAnswerLabPresenter";
import { SemanticSearchLabPresenter } from "./presenters/SemanticSearchLabPresenter";
import { ChunkingLab } from "./ui/ChunkingLab";
import { FailureLab } from "./ui/FailureLab";
import { GroundedAnswerLab } from "./ui/GroundedAnswerLab";
import { SearchLab } from "./ui/SearchLab";
import { usePresenter } from "./ui/usePresenter";

type LabMode = "chunking" | "search" | "answer" | "failure";

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
  const failureLab = usePresenter(
    (onChange) => new FailureLabPresenter(onChange, gateway),
    [gateway],
    labMode === "failure",
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
          <button type="button" className={labMode === "failure" ? "active" : ""} onClick={() => setLabMode("failure")}>Failure Lab</button>
        </nav>

        <div className={`connection ${chunking.model.connectionFailed ? "connection--error" : ""}`}>
          <span className="connection__dot" />
          {chunking.model.connectionLabel}
        </div>
      </header>

      {labMode === "chunking" && <ChunkingLab presenter={chunking} model={chunking.model} />}
      {labMode === "search" && <SearchLab presenter={search} model={search.model} />}
      {labMode === "answer" && <GroundedAnswerLab presenter={groundedAnswer} model={groundedAnswer.model} />}
      {labMode === "failure" && <FailureLab presenter={failureLab} model={failureLab.model} />}
    </div>
  );
}
