export type LabDestination = "chunking" | "search" | "answer" | "failure";

type HomeProps = {
  onEnter: (destination: LabDestination) => void;
};

const LABS: { mode: LabDestination; number: string; title: string; description: string }[] = [
  {
    mode: "chunking",
    number: "01",
    title: "Chunking visible",
    description:
      "Cómo se parte un documento en fragmentos. Cambiá el tamaño y el overlap y mirá qué se duplica, qué se corta y cuánto contexto se embebe.",
  },
  {
    mode: "search",
    number: "02",
    title: "Búsqueda semántica",
    description:
      "Cómo una pregunta y los fragmentos se vuelven vectores. Compará ranking, threshold, top-k y el aislamiento entre tenants.",
  },
  {
    mode: "answer",
    number: "03",
    title: "Grounded answer",
    description:
      "Una respuesta donde cada afirmación se rastrea hasta la evidencia que la sostiene, con el run completo a la vista.",
  },
  {
    mode: "failure",
    number: "04",
    title: "Failure Lab",
    description:
      "Cambiá una sola variable contra un baseline y observá qué casos se rompen y qué capa del pipeline es la responsable.",
  },
];

const PRINCIPLES = [
  "Embeddings locales, sin API key",
  "Aislamiento por tenant siempre activo",
  "Cada cita apunta al texto exacto",
];

export function Home({ onEnter }: HomeProps) {
  return (
    <main className="home">
      <section className="home-hero">
        <span className="overline">Laboratorio de evidencia</span>
        <h1>RAG con la evidencia a la vista.</h1>
        <p className="home-lede">
          Un laboratorio observable sobre políticas de tesorería. Cambiá una
          variable —el tamaño de un chunk, un umbral, un filtro— y mirá, paso a
          paso, qué evidencia recupera el sistema y cómo llega a su respuesta.
        </p>
        <div className="home-tags">
          {PRINCIPLES.map((principle) => (
            <span key={principle}>{principle}</span>
          ))}
        </div>
      </section>

      <section className="home-pipeline" aria-label="Las cuatro etapas del laboratorio">
        {LABS.map((lab) => (
          <button
            type="button"
            className="lab-card"
            key={lab.mode}
            onClick={() => onEnter(lab.mode)}
          >
            <span className="lab-card__n" aria-hidden="true">{lab.number}</span>
            <h2>{lab.title}</h2>
            <p>{lab.description}</p>
            <span className="lab-card__cta">
              Abrir <b aria-hidden="true">→</b>
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}
