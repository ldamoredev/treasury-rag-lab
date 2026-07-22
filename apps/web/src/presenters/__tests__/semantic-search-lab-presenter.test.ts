import { describe, expect, it, vi } from "vitest";

import { SemanticSearchLabPresenter } from "../semantic-search-lab-presenter";
import {
  FakeTreasuryRagGateway,
  searchResponse,
} from "./presenter-fixtures";

describe("SemanticSearchLabPresenter", () => {
  it("builds the search request and exposes result statistics", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new SemanticSearchLabPresenter(vi.fn(), gateway);
    presenter.start();
    presenter.setQuery("pago parcial");
    presenter.setTenant("boreal");
    presenter.setTopK(3);

    await presenter.submit();

    expect(gateway.searchCalls[0]).toMatchObject({
      query: "pago parcial",
      tenant: "boreal",
      config: { topK: 3, tenantFilterEnabled: true },
    });
    expect(presenter.model.metrics?.dimensions).toBe("384 dimensiones");
    expect(presenter.model.isLoading).toBe(false);
  });

  it("aborts an in-flight search when stopped", async () => {
    const gateway = new FakeTreasuryRagGateway();
    let resolveSearch!: (response: typeof searchResponse) => void;
    gateway.searchResult = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    const presenter = new SemanticSearchLabPresenter(vi.fn(), gateway);
    presenter.start();

    const submission = presenter.submit();
    await vi.waitFor(() => expect(gateway.signals).toHaveLength(1));
    expect(presenter.model.isLoading).toBe(true);
    presenter.stop();

    expect(gateway.signals.at(-1)?.aborted).toBe(true);
    expect(presenter.model.isLoading).toBe(false);
    resolveSearch(searchResponse);
    await submission;
  });
});
