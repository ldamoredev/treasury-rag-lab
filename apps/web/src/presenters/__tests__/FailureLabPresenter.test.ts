import { describe, expect, it, vi } from "vitest";

import { FailureLabPresenter } from "../FailureLabPresenter";
import {
  FakeTreasuryRagGateway,
  failureLabComparisonResponse,
} from "./presenterFixtures";

describe("FailureLabPresenter", () => {
  it("loads the predefined experiments on start and selects the first one", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new FailureLabPresenter(vi.fn(), gateway);

    presenter.start();
    await vi.waitFor(() => expect(presenter.model.isLoadingList).toBe(false));

    expect(presenter.model.experimentOptions).toEqual([
      { id: "tenant-filter-on-vs-off", name: "Tenant filter: on vs off" },
    ]);
    expect(presenter.model.selectedExperimentId).toBe("tenant-filter-on-vs-off");
    expect(presenter.model.selected?.variableLabel).toBe("Filtro de tenant");
    const changedRows = presenter.model.selected?.configRows.filter(
      (row) => row.changed,
    );
    expect(changedRows).toEqual([
      { label: "Filtro de tenant", baseline: "on", variant: "off", changed: true },
    ]);
  });

  it("does not load experiments before start", () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new FailureLabPresenter(vi.fn(), gateway);

    expect(presenter.model.experimentOptions).toEqual([]);
    expect(presenter.model.selectedExperimentId).toBeUndefined();
  });

  it("runs the comparison for the selected experiment and exposes deltas", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new FailureLabPresenter(vi.fn(), gateway);
    presenter.start();
    await vi.waitFor(() => expect(presenter.model.isLoadingList).toBe(false));

    await presenter.runComparison();

    expect(gateway.comparisonCalls).toEqual([
      { experimentId: "tenant-filter-on-vs-off" },
    ]);
    const comparison = presenter.model.comparison;
    expect(comparison?.metricRows[0]).toMatchObject({
      label: "Fuga entre tenants",
      baselineRate: "100%",
      variantRate: "60%",
      delta: "-40 pts",
      deltaTone: "bad",
    });
    expect(comparison?.metricRows[1]?.deltaTone).toBe("neutral");
    expect(comparison?.degradedCases[0]).toMatchObject({
      caseId: "acme-exclusive-rule",
      baselineStatus: "Pasa",
      variantStatus: "Falla",
    });
    expect(comparison?.responsibleLayerLabel).toBe("Filtering");
    expect(comparison?.suggestedFix).toBe("Reactivar el filtro de tenant.");
    expect(presenter.model.isRunning).toBe(false);
  });

  it("clears the previous comparison when the experiment changes", async () => {
    const gateway = new FakeTreasuryRagGateway();
    const presenter = new FailureLabPresenter(vi.fn(), gateway);
    presenter.start();
    await vi.waitFor(() => expect(presenter.model.isLoadingList).toBe(false));
    await presenter.runComparison();
    expect(presenter.model.comparison).toBeDefined();

    presenter.selectExperiment("tenant-filter-on-vs-off");
    expect(presenter.model.comparison).toBeDefined();

    presenter.selectExperiment("another-experiment");
    expect(presenter.model.comparison).toBeUndefined();
    expect(presenter.model.error).toBeUndefined();
  });

  it("surfaces gateway errors without exposing internals", async () => {
    const gateway = new FakeTreasuryRagGateway();
    gateway.compareFailureLabExperiment = () => Promise.reject(new Error("boom"));
    const presenter = new FailureLabPresenter(vi.fn(), gateway);
    presenter.start();
    await vi.waitFor(() => expect(presenter.model.isLoadingList).toBe(false));

    await presenter.runComparison();

    expect(presenter.model.error).toBe("boom");
    expect(presenter.model.comparison).toBeUndefined();
    expect(presenter.model.isRunning).toBe(false);
  });

  it("aborts an in-flight comparison when stopped", async () => {
    const gateway = new FakeTreasuryRagGateway();
    let resolveComparison!: (response: typeof failureLabComparisonResponse) => void;
    gateway.comparisonResult = new Promise((resolve) => {
      resolveComparison = resolve;
    });
    const presenter = new FailureLabPresenter(vi.fn(), gateway);
    presenter.start();
    await vi.waitFor(() => expect(presenter.model.isLoadingList).toBe(false));

    const running = presenter.runComparison();
    await vi.waitFor(() => expect(presenter.model.isRunning).toBe(true));
    presenter.stop();

    expect(gateway.signals.at(-1)?.aborted).toBe(true);
    expect(presenter.model.isRunning).toBe(false);
    resolveComparison(failureLabComparisonResponse);
    await running;
    expect(presenter.model.comparison).toBeUndefined();
  });
});
