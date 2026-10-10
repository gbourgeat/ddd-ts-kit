import type { JobExecution } from '@ddd-ts-kit/kernel';

/** A job that remembers its executions and, when gated, stays in progress until the test opens the gate. */
export class RecordingJob {
  readonly executions: JobExecution[] = [];

  private openGate: (() => void) | undefined;

  private closedGate: Promise<void> | undefined;

  readonly run = async (execution: JobExecution): Promise<void> => {
    this.executions.push(execution);
    await this.closedGate;
  };

  get scheduledAt(): string[] {
    return this.executions.map((execution) => execution.scheduledAt.toISOString());
  }

  gate(): void {
    this.closedGate = new Promise((resolve) => {
      this.openGate = resolve;
    });
  }

  open(): void {
    this.openGate?.();
    this.closedGate = undefined;
  }
}
