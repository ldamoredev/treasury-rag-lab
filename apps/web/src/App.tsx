import {
  HealthResponseSchema,
  type HealthResponse,
} from "@treasury-rag/contracts";
import { useEffect, useState } from "react";

type ApiState =
  | { status: "loading" }
  | { status: "ready"; health: HealthResponse }
  | { status: "error"; message: string };

export function App() {
  const [apiState, setApiState] = useState<ApiState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch("/health", { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Health check failed with HTTP ${response.status}`);
        }

        const health = HealthResponseSchema.parse(await response.json());
        setApiState({ status: "ready", health });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setApiState({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    void checkApi();

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Slice 0 · Scaffold</p>
        <h1>Treasury RAG Lab</h1>
        <p className="lede">
          An observable laboratory for understanding retrieval, grounding, and
          failure modes in treasury-policy assistants.
        </p>

        <div className={`status status--${apiState.status}`} aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          <div>
            <strong>API status</strong>
            {apiState.status === "loading" && <p>Checking shared contract…</p>}
            {apiState.status === "ready" && (
              <p>
                Connected to <code>{apiState.health.service}</code>
              </p>
            )}
            {apiState.status === "error" && <p>{apiState.message}</p>}
          </div>
        </div>
      </section>

      <aside className="next-step">
        <span>Next experiment</span>
        <h2>Visible chunking</h2>
        <p>
          Compare character and heading strategies while inspecting exactly
          what evidence each chunk preserves.
        </p>
      </aside>
    </main>
  );
}
