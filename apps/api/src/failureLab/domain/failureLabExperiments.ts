import {
  FailureLabExperimentSchema,
  type FailureLabConfig,
  type FailureLabExperiment,
} from "@treasury-rag/contracts";

const BASELINE: FailureLabConfig = {
  chunking: { strategy: "characters", chunkSize: 300, overlap: 0 },
  topK: 5,
  threshold: 0.7,
  tenantFilterEnabled: true,
  latestVersionOnly: true,
};

type ConfigOverrides = Partial<Omit<FailureLabConfig, "chunking">> & {
  chunking?: Partial<FailureLabConfig["chunking"]>;
};

function experiment(
  input: Omit<FailureLabExperiment, "baseline" | "variant"> & {
    baseline?: ConfigOverrides;
    variant: ConfigOverrides;
  },
): FailureLabExperiment {
  const { baseline, variant, ...metadata } = input;
  const merge = (overrides: ConfigOverrides): FailureLabConfig => ({
    ...BASELINE,
    ...overrides,
    chunking: { ...BASELINE.chunking, ...overrides.chunking },
  });

  return FailureLabExperimentSchema.parse({
    ...metadata,
    baseline: merge(baseline ?? {}),
    variant: merge(variant),
  });
}

/**
 * Predefined single-variable experiments. Each baseline/variant pair changes
 * exactly one knob so the observed failure can be attributed to one layer,
 * and each fix stays inside that layer (retrieval failures are never
 * "fixed" by editing the prompt, nor generation failures by changing
 * embeddings).
 */
export const failureLabExperiments: FailureLabExperiment[] = [
  experiment({
    id: "chunk-size-300-vs-900",
    name: "Chunk size: 300 vs 900",
    description:
      "Compara chunks de 300 caracteres contra chunks de 900. El experimento muestra si la cobertura ganada al evitar cortes compensa el contexto adicional dentro de cada vector.",
    variable: "chunkSize",
    variant: { chunking: { chunkSize: 900 } },
    responsibleLayer: "chunking",
    suggestedFix:
      "Elegir el tamaño con evidencia del dataset. Si los chunks chicos cortan reglas, aumentar el tamaño o usar headings; si los grandes mezclan temas, reducirlo y volver a evaluar.",
    learning:
      "No existe un tamaño universalmente correcto: en este corpus los chunks grandes pueden recuperar frases cortadas, pero recall por sí solo no mide cuánto ruido agregan al prompt.",
  }),
  experiment({
    id: "overlap-0-vs-120",
    name: "Overlap: 0 vs 120",
    description:
      "Compara chunks sin solapamiento contra 120 caracteres de solapamiento. El overlap protege las frases que quedan cortadas en los bordes.",
    variable: "overlap",
    variant: { chunking: { overlap: 120 } },
    responsibleLayer: "chunking",
    suggestedFix:
      "Mantener un overlap moderado (80-120) cuando las reglas quedan partidas entre chunks consecutivos.",
    learning:
      "Sin overlap, una evidencia que cruza el borde entre dos chunks puede no aparecer completa en ninguno y el recall cae.",
  }),
  experiment({
    id: "topk-2-vs-8",
    name: "Top-k: 2 vs 8",
    description:
      "Compara devolver 2 chunks contra 8. Un top-k chico pierde evidencia distribuida; uno grande mete ruido en el contexto.",
    variable: "topK",
    baseline: { topK: 2 },
    variant: { topK: 8 },
    responsibleLayer: "retrieval",
    suggestedFix:
      "Elegir top-k según la cobertura medida (recall@k) y combinarlo con threshold, no agrandarlo a ciegas.",
    learning:
      "El recall@k muestra la cobertura que se pierde con una ventana chica. El posible ruido de una ventana grande debe evaluarse aparte sobre la respuesta grounded.",
  }),
  experiment({
    id: "threshold-040-vs-080",
    name: "Threshold: 0.40 vs 0.80",
    description:
      "Compara un piso de similitud permisivo contra uno estricto. Umbrales bajos dejan pasar ruido; umbrales altos descartan evidencia válida.",
    variable: "threshold",
    baseline: { threshold: 0.4 },
    variant: { threshold: 0.8 },
    responsibleLayer: "retrieval",
    suggestedFix:
      "Calibrar el threshold con el dataset de evals: subirlo hasta filtrar ruido sin perder los fragmentos esperados.",
    learning:
      "El threshold es un filtro de precisión: demasiado bajo recupera chunks irrelevantes; demasiado alto produce abstenciones con evidencia disponible.",
  }),
  experiment({
    id: "tenant-filter-on-vs-off",
    name: "Tenant filter: on vs off",
    description:
      "Compara el aislamiento obligatorio de tenant contra un retrieval sin filtro. Sin filtro, las reglas de Boreal pueden responder preguntas de Acme.",
    variable: "tenantFilter",
    variant: { tenantFilterEnabled: false },
    responsibleLayer: "filtering",
    suggestedFix:
      "Reactivar el filtro de tenant en la selección de documentos; el aislamiento no se corrige con instrucciones del prompt.",
    learning:
      "La fuga entre tenants ocurre en retrieval, antes del prompt: una vez que el chunk de otro tenant entra al contexto, el modelo ya lo puede citar.",
  }),
  experiment({
    id: "latest-version-on-vs-off",
    name: "Latest-version filter: on vs off",
    description:
      "Compara el filtro de versión vigente contra un corpus con la política histórica v1 visible. Sin filtro, el umbral viejo de ARS 40.000,00 compite con el vigente.",
    variable: "latestVersionFilter",
    variant: { latestVersionOnly: false },
    responsibleLayer: "filtering",
    suggestedFix:
      "Mantener latestVersionOnly en true (default seguro) y conservar las versiones históricas fuera del retrieval operativo.",
    learning:
      "Las versiones viejas no desaparecen por similitud: sin un filtro explícito, una política derogada puede rankear mejor que la vigente.",
  }),
];

export function findFailureLabExperiment(
  id: string,
): FailureLabExperiment | undefined {
  return failureLabExperiments.find((experiment) => experiment.id === id);
}
