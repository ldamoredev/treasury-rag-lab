import { useMemo, useState } from "react";

import { HttpTreasuryRagGateway } from "./core/infrastructure/http/HttpTreasuryRagGateway";
import { ChunkingLabPresenter } from "./presenters/ChunkingLabPresenter";
import { FailureLabPresenter } from "./presenters/FailureLabPresenter";
import { GroundedAnswerLabPresenter } from "./presenters/GroundedAnswerLabPresenter";
import { SemanticSearchLabPresenter } from "./presenters/SemanticSearchLabPresenter";
import { ChunkingLab } from "./ui/ChunkingLab";
import { FailureLab } from "./ui/FailureLab";
import { GroundedAnswerLab } from "./ui/GroundedAnswerLab";
import { Home } from "./ui/Home";
import { SearchLab } from "./ui/SearchLab";
import { usePresenter } from "./ui/usePresenter";

type LabMode = "home" | "chunking" | "search" | "answer" | "failure";
type Theme = "light" | "dark";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function App() {
  const [labMode, setLabMode] = useState<LabMode>("home");
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
  );

  function toggleTheme() {
    setTheme((previous) => {
      const next: Theme = previous === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem("theme", next);
      } catch {
        /* storage unavailable — keep the in-memory choice */
      }
      return next;
    });
  }
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
        <button type="button" className="brand" onClick={() => setLabMode("home")} aria-label="Volver al inicio">
          <span className="brand__mark">TR</span>
          <div><p>Treasury RAG Lab</p><span>Laboratorio de evidencia</span></div>
        </button>

        <nav className="lab-nav" aria-label="Secciones del laboratorio">
          <button type="button" className={labMode === "chunking" ? "active" : ""} onClick={() => setLabMode("chunking")}>Chunking</button>
          <button type="button" className={labMode === "search" ? "active" : ""} onClick={() => setLabMode("search")}>Semantic search</button>
          <button type="button" className={labMode === "answer" ? "active" : ""} onClick={() => setLabMode("answer")}>Grounded answer</button>
          <button type="button" className={labMode === "failure" ? "active" : ""} onClick={() => setLabMode("failure")}>Failure Lab</button>
        </nav>

        <div className="topbar__right">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
            title="Cambiar tema"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          {labMode === "home" ? (
            <div className="connection connection--ghost" aria-hidden="true" />
          ) : (
            <div className={`connection ${chunking.model.connectionFailed ? "connection--error" : ""}`}>
              <span className="connection__dot" />
              {chunking.model.connectionLabel}
            </div>
          )}
        </div>
      </header>

      {labMode === "home" && <Home onEnter={setLabMode} />}
      {labMode === "chunking" && <ChunkingLab presenter={chunking} model={chunking.model} />}
      {labMode === "search" && <SearchLab presenter={search} model={search.model} />}
      {labMode === "answer" && <GroundedAnswerLab presenter={groundedAnswer} model={groundedAnswer.model} />}
      {labMode === "failure" && <FailureLab presenter={failureLab} model={failureLab.model} />}
    </div>
  );
}
