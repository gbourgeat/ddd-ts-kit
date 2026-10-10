import type { IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

/** A provider that keeps every publication waiting until the test opens the gate. */
export class GatedPublisher implements IntegrationEventPublisher {
  readonly delivered: string[] = [];

  private openGate: () => void = () => undefined;

  private readonly gate = new Promise<void>((resolve) => {
    this.openGate = resolve;
  });

  private signalEntered: () => void = () => undefined;

  readonly entered = new Promise<void>((resolve) => {
    this.signalEntered = resolve;
  });

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    this.signalEntered();
    await this.gate;
    this.delivered.push(...events.map((event) => event.id));
  }

  open(): void {
    this.openGate();
  }
}
