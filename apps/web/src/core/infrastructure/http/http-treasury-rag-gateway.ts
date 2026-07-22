import {
  ChunkPreviewResponseSchema,
  DocumentListResponseSchema,
  GroundedAnswerResponseSchema,
  RunCreatedResponseSchema,
  RunEventSchema,
  SearchResponseSchema,
  type ChunkPreviewRequest,
  type GroundedAnswerRequest,
  type RunEventType,
  type SearchRequest,
} from "@treasury-rag/contracts";

import type {
  GatewayRequestOptions,
  RunObserver,
  RunStream,
  TreasuryRagGateway,
} from "../../ports/treasury-rag-gateway";

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

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type EventSourceLike = {
  readonly readyState: number;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  close(): void;
};

type ResponseSchema<Output> = {
  parse(input: unknown): Output;
};

type HttpGatewayOptions = {
  fetcher?: Fetcher;
  eventSourceFactory?: (url: string) => EventSourceLike;
};

export class TreasuryRagGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TreasuryRagGatewayError";
  }
}

class EventSourceRunStream implements RunStream {
  private closed = false;

  constructor(
    private readonly source: EventSourceLike,
    private readonly observer: RunObserver,
    private readonly signal?: AbortSignal,
  ) {
    for (const eventType of RUN_EVENT_TYPES) {
      source.addEventListener(eventType, this.receive);
    }
    source.onerror = this.connectionError;
    signal?.addEventListener("abort", this.close, { once: true });
  }

  close = (): void => {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.signal?.removeEventListener("abort", this.close);
    for (const eventType of RUN_EVENT_TYPES) {
      this.source.removeEventListener(eventType, this.receive);
    }
    this.source.onerror = null;
    this.source.close();
  };

  private readonly receive: EventListener = (rawEvent) => {
    try {
      const message = rawEvent as MessageEvent<string>;
      const event = RunEventSchema.parse(JSON.parse(message.data));
      this.observer.onEvent(event);
      if (event.type === "run.completed" || event.type === "run.failed") {
        this.close();
      }
    } catch (error) {
      this.observer.onError(error);
      this.close();
    }
  };

  private readonly connectionError = () => {
    if (!this.closed && this.source.readyState !== 2) {
      this.observer.onReconnecting();
    }
  };
}

export class HttpTreasuryRagGateway implements TreasuryRagGateway {
  private readonly fetcher: Fetcher;
  private readonly eventSourceFactory: (url: string) => EventSourceLike;

  constructor(options: HttpGatewayOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.eventSourceFactory = options.eventSourceFactory
      ?? ((url) => new EventSource(url));
  }

  listDocuments(options: GatewayRequestOptions = {}) {
    return this.request(
      "/api/documents",
      { method: "GET", ...signalOption(options.signal) },
      DocumentListResponseSchema,
    );
  }

  previewChunks(
    request: ChunkPreviewRequest,
    options: GatewayRequestOptions = {},
  ) {
    return this.post(
      "/api/chunks/preview",
      request,
      ChunkPreviewResponseSchema,
      options,
    );
  }

  search(request: SearchRequest, options: GatewayRequestOptions = {}) {
    return this.post("/api/search", request, SearchResponseSchema, options);
  }

  answer(
    request: GroundedAnswerRequest,
    options: GatewayRequestOptions = {},
  ) {
    return this.post(
      "/api/answer",
      request,
      GroundedAnswerResponseSchema,
      options,
    );
  }

  async startRun(
    request: GroundedAnswerRequest,
    observer: RunObserver,
    options: GatewayRequestOptions = {},
  ): Promise<RunStream> {
    const { runId } = await this.post(
      "/api/runs",
      request,
      RunCreatedResponseSchema,
      options,
    );
    if (options.signal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }

    const source = this.eventSourceFactory(`/api/runs/${runId}/events`);
    return new EventSourceRunStream(source, observer, options.signal);
  }

  private post<Output>(
    path: string,
    body: unknown,
    schema: ResponseSchema<Output>,
    options: GatewayRequestOptions,
  ): Promise<Output> {
    return this.request(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        ...signalOption(options.signal),
      },
      schema,
    );
  }

  private async request<Output>(
    path: string,
    init: RequestInit,
    schema: ResponseSchema<Output>,
  ): Promise<Output> {
    const response = await this.fetcher(path, init);
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new TreasuryRagGatewayError(
        readApiError(body) ?? `Request failed (${response.status})`,
        response.status,
      );
    }
    return schema.parse(body);
  }
}

function signalOption(
  signal: AbortSignal | undefined,
): Pick<RequestInit, "signal"> | object {
  return signal === undefined ? {} : { signal };
}

function readApiError(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return undefined;
  }
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : undefined;
}
