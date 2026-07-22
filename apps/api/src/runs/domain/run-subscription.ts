import type { RunEvent } from "@treasury-rag/contracts";

export class RunSubscription {
  private active = true;

  constructor(
    readonly events: RunEvent[],
    readonly terminal: boolean,
    private readonly unsubscribeAction: () => void,
  ) {}

  unsubscribe(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.unsubscribeAction();
  }
}
