import { describe, expect, it, vi } from "vitest";

import { ChunkingLabPresenter } from "../chunking-lab-presenter";
import {
  FakeTreasuryRagGateway,
  previewResponse,
} from "./presenter-fixtures";

describe("ChunkingLabPresenter", () => {
  it("loads documents and previews the first document on start", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new ChunkingLabPresenter(vi.fn(), gateway, 0);

    presenter.start();

    await vi.waitFor(() => expect(gateway.previewCalls).toHaveLength(1));
    expect(gateway.previewCalls[0]).toEqual({
      documentId: "partial-payments",
      config: { strategy: "characters", chunkSize: 300, overlap: 80 },
    });
    expect(presenter.model.previewTitle).toBe("Política global");
  });

  it("keeps overlap below chunk size when settings change", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new ChunkingLabPresenter(vi.fn(), gateway, 0);
    presenter.start();
    await vi.waitFor(() => expect(gateway.previewCalls).toHaveLength(1));

    presenter.setOverlap(80);
    presenter.setChunkSize(40);

    await vi.waitFor(() => expect(gateway.previewCalls.length).toBeGreaterThan(1));
    expect(presenter.model.overlap).toBe(39);
    expect(gateway.previewCalls.at(-1)?.config).toEqual({
      strategy: "characters",
      chunkSize: 40,
      overlap: 39,
    });
  });

  it("aborts requests on stop and can be started again", async () => {
    const gateway = new FakeTreasuryRagGateway();
    let resolvePreview!: (response: typeof previewResponse) => void;
    gateway.previewResult = new Promise((resolve) => {
      resolvePreview = resolve;
    });
    const presenter = new ChunkingLabPresenter(vi.fn(), gateway, 0);

    presenter.start();
    await vi.waitFor(() => expect(gateway.signals).toHaveLength(2));
    expect(presenter.model.isLoading).toBe(true);
    presenter.stop();
    expect(gateway.signals.every((signal) => signal.aborted)).toBe(true);
    expect(presenter.model.isLoading).toBe(false);

    resolvePreview(previewResponse);
    presenter.start();
    await vi.waitFor(() => expect(gateway.signals).toHaveLength(4));
  });
});
