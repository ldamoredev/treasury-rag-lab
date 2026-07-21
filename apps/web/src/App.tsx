import {
  ChunkPreviewResponseSchema,
  DocumentListResponseSchema,
  type Chunk,
  type ChunkPreviewResponse,
  type ChunkingConfig,
  type DocumentSummary,
} from "@treasury-rag/contracts";
import { useEffect, useState } from "react";

type Strategy = ChunkingConfig["strategy"];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado";
}

function tenantLabel(tenant: DocumentSummary["tenant"]) {
  switch (tenant) {
    case "global":
      return "Global";
    case "acme":
      return "Acme";
    case "boreal":
      return "Boreal";
  }
}

function ChunkText({ chunk, previousChunk }: {
  chunk: Chunk;
  previousChunk: Chunk | undefined;
}) {
  const overlapCharacters = previousChunk
    ? Math.max(0, previousChunk.endOffset - chunk.startOffset)
    : 0;

  if (overlapCharacters === 0) {
    return <>{chunk.text}</>;
  }

  return (
    <>
      <mark title={`${overlapCharacters} caracteres repetidos`}>
        {chunk.text.slice(0, overlapCharacters)}
      </mark>
      {chunk.text.slice(overlapCharacters)}
    </>
  );
}

export function App() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentsError, setDocumentsError] = useState<string>();
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("characters");
  const [chunkSize, setChunkSize] = useState(300);
  const [overlap, setOverlap] = useState(80);
  const [maxChunkSize, setMaxChunkSize] = useState(600);
  const [preview, setPreview] = useState<ChunkPreviewResponse>();
  const [previewError, setPreviewError] = useState<string>();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      try {
        const response = await fetch("/api/documents", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`No se pudieron cargar los documentos (${response.status})`);
        }

        const body = DocumentListResponseSchema.parse(await response.json());
        setDocuments(body.documents);
        setSelectedDocumentId((current) => current || body.documents[0]?.id || "");
      } catch (error) {
        if (!controller.signal.aborted) {
          setDocumentsError(errorMessage(error));
        }
      }
    }

    void loadDocuments();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedDocumentId) {
      return;
    }

    const controller = new AbortController();
    const config: ChunkingConfig = strategy === "characters"
      ? { strategy, chunkSize, overlap }
      : { strategy, maxChunkSize };

    setIsPreviewLoading(true);
    setPreviewError(undefined);

    const timer = window.setTimeout(() => {
      async function loadPreview() {
        try {
          const response = await fetch("/api/chunks/preview", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              documentId: selectedDocumentId,
              config,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`No se pudo generar el preview (${response.status})`);
          }

          setPreview(ChunkPreviewResponseSchema.parse(await response.json()));
        } catch (error) {
          if (!controller.signal.aborted) {
            setPreviewError(errorMessage(error));
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsPreviewLoading(false);
          }
        }
      }

      void loadPreview();
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [chunkSize, maxChunkSize, overlap, selectedDocumentId, strategy]);

  const selectedDocument = documents.find(
    (document) => document.id === selectedDocumentId,
  );

  function updateChunkSize(nextChunkSize: number) {
    const normalizedSize = Math.max(1, Math.min(5_000, nextChunkSize));
    setChunkSize(normalizedSize);
    setOverlap((current) => Math.min(current, normalizedSize - 1));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">TR</span>
          <div>
            <p>Treasury RAG Lab</p>
            <span>Laboratorio de evidencia</span>
          </div>
        </div>

        <div className={`connection ${documentsError ? "connection--error" : ""}`}>
          <span className="connection__dot" />
          {documentsError ? "API sin conexión" : documents.length > 0 ? "API conectada" : "Conectando…"}
        </div>
      </header>

      <main className="workspace">
        <aside className="control-panel">
          <div className="section-heading">
            <span>Slice 01</span>
            <h1>Chunking visible</h1>
            <p>Cambiá una variable y observá cómo se transforma la evidencia.</p>
          </div>

          {documentsError ? (
            <div className="error-box" role="alert">{documentsError}</div>
          ) : (
            <>
              <div className="field-group">
                <label htmlFor="document">Documento</label>
                <select
                  id="document"
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                >
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
                {selectedDocument && (
                  <div className="document-meta">
                    <span>{tenantLabel(selectedDocument.tenant)}</span>
                    <span>v{selectedDocument.version}</span>
                    <span>{selectedDocument.effectiveFrom}</span>
                  </div>
                )}
              </div>

              <div className="field-group">
                <span className="field-label">Estrategia</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={strategy === "characters" ? "active" : ""}
                    onClick={() => setStrategy("characters")}
                  >
                    Caracteres
                  </button>
                  <button
                    type="button"
                    className={strategy === "headings" ? "active" : ""}
                    onClick={() => setStrategy("headings")}
                  >
                    Headings
                  </button>
                </div>
              </div>

              {strategy === "characters" ? (
                <>
                  <div className="field-group range-field">
                    <div className="range-field__header">
                      <label htmlFor="chunk-size">Chunk size</label>
                      <input
                        aria-label="Valor de chunk size"
                        type="number"
                        min="1"
                        max="5000"
                        value={chunkSize}
                        onChange={(event) => updateChunkSize(Number(event.target.value))}
                      />
                    </div>
                    <input
                      id="chunk-size"
                      type="range"
                      min="100"
                      max="1200"
                      step="50"
                      value={Math.min(1200, Math.max(100, chunkSize))}
                      onChange={(event) => updateChunkSize(Number(event.target.value))}
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
                        max={chunkSize - 1}
                        value={overlap}
                        onChange={(event) => setOverlap(
                          Math.max(0, Math.min(chunkSize - 1, Number(event.target.value))),
                        )}
                      />
                    </div>
                    <input
                      id="overlap"
                      type="range"
                      min="0"
                      max={Math.min(300, chunkSize - 1)}
                      step="10"
                      value={Math.min(overlap, Math.min(300, chunkSize - 1))}
                      onChange={(event) => setOverlap(Number(event.target.value))}
                    />
                    <div className="range-labels"><span>0</span><span>{Math.min(300, chunkSize - 1)}</span></div>
                  </div>
                </>
              ) : (
                <div className="field-group range-field">
                  <div className="range-field__header">
                    <label htmlFor="max-chunk-size">Máximo por chunk</label>
                    <input
                      aria-label="Valor máximo por chunk"
                      type="number"
                      min="1"
                      max="5000"
                      value={maxChunkSize}
                      onChange={(event) => setMaxChunkSize(
                        Math.max(1, Math.min(5_000, Number(event.target.value))),
                      )}
                    />
                  </div>
                  <input
                    id="max-chunk-size"
                    type="range"
                    min="100"
                    max="1600"
                    step="50"
                    value={Math.min(1600, Math.max(100, maxChunkSize))}
                    onChange={(event) => setMaxChunkSize(Number(event.target.value))}
                  />
                  <div className="range-labels"><span>100</span><span>1600</span></div>
                </div>
              )}

              <div className="learning-note">
                <span>Qué mirar</span>
                <p>
                  El amarillo señala texto duplicado por overlap. Prestá atención a
                  títulos aislados, reglas cortadas y chunks con demasiado contexto.
                </p>
              </div>
            </>
          )}
        </aside>

        <section className="inspector">
          <div className="inspector__header">
            <div>
              <p className="overline">Inspector de fragmentación</p>
              <h2>{preview?.document.title ?? "Preparando documento…"}</h2>
            </div>
            {isPreviewLoading && <span className="updating">Actualizando</span>}
          </div>

          {previewError && <div className="error-box" role="alert">{previewError}</div>}

          {preview && (
            <>
              <div className="metrics" aria-label="Estadísticas de chunking">
                <article>
                  <span>Chunks</span>
                  <strong>{preview.stats.chunkCount}</strong>
                </article>
                <article>
                  <span>Documento</span>
                  <strong>{preview.stats.documentCharacters}</strong>
                  <small>caracteres</small>
                </article>
                <article className={preview.stats.duplicatedCharacters > 0 ? "metric--warning" : ""}>
                  <span>Duplicados</span>
                  <strong>{preview.stats.duplicatedCharacters}</strong>
                  <small>por overlap</small>
                </article>
                <article>
                  <span>Promedio</span>
                  <strong>{Math.round(preview.stats.averageChunkCharacters)}</strong>
                  <small>caracteres</small>
                </article>
              </div>

              <div className={`chunk-list ${isPreviewLoading ? "chunk-list--updating" : ""}`}>
                {preview.chunks.map((chunk, index) => (
                  <article className="chunk-card" key={chunk.id}>
                    <div className="chunk-card__rail">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <i />
                    </div>
                    <div className="chunk-card__body">
                      <header>
                        <div>
                          <strong>Chunk {chunk.index}</strong>
                          <span>{chunk.startOffset}–{chunk.endOffset}</span>
                        </div>
                        <span className="length-pill">{chunk.text.length} chars</span>
                      </header>
                      <pre><ChunkText chunk={chunk} previousChunk={preview.chunks[index - 1]} /></pre>
                      <footer>
                        <code>{chunk.id}</code>
                        <span>{tenantLabel(chunk.tenant)} · v{chunk.version}</span>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
