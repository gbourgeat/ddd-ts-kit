import {
  InMemoryDomainEventDispatcher,
  InMemoryErrorReporter,
  InMemoryLogger,
  dispatchingOnSave,
  reportAfterCommitFailures,
  type DomainEvent,
  type DomainEventCallback,
  type DomainEventPhase,
} from '@ddd-ts-kit/kernel';
import { Parcel } from './parcel.js';
import { Parcels } from './parcels.js';
import type { UnitOfWorkUnderContract } from './unit-of-work-under-contract.js';

const LATER = new Date('2100-01-01T00:00:00.000Z');

/** The wiring of a composition root around the subject, with a journal of what happened, in order. */
export class ShippingBench {
  readonly journal: string[] = [];

  readonly reporter = new InMemoryErrorReporter();

  readonly logger = new InMemoryLogger();

  readonly dispatcher = new InMemoryDomainEventDispatcher(reportAfterCommitFailures({ reporter: this.reporter, logger: this.logger }));

  readonly parcels: Parcels;

  constructor(readonly subject: UnitOfWorkUnderContract) {
    this.parcels = dispatchingOnSave(new Parcels(subject), () => this.dispatcher);
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.subject.unitOfWork.run(work);
  }

  /** Saves a new parcel under each id, one save after the other, noting each save. */
  async register(...ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.parcels.save(Parcel.register(id));
      this.journal.push(`saved ${id}`);
    }
  }

  on(phase: DomainEventPhase, handler: DomainEventCallback, name: string = Parcel.REGISTERED): void {
    this.dispatcher.on(name, handler, { phase });
  }

  /** Notes `<label> <id>` for every registered parcel, in that phase. */
  note(phase: DomainEventPhase, label: string): void {
    this.on(phase, async (event) => void this.journal.push(`${label} ${event.aggregateId}`));
  }

  /** The publisher of the context: before the commit, one integration event per registered parcel, to the outbox. */
  publish(): void {
    this.on('before-commit', async (event) => {
      await this.subject.outbox.append([published(event)]);
      this.journal.push(`published ${event.aggregateId}`);
    });
  }

  /** The ids of the events a relay would publish now, oldest first. */
  async relayed(): Promise<string[]> {
    return (await this.subject.outbox.claimBatch(100, LATER)).map((record) => record.event.id);
  }

  async pending(): Promise<number> {
    return (await this.subject.outbox.stats()).pending;
  }
}

function published(event: DomainEvent): { id: string; type: string; version: number; occurredAt: string; payload: unknown } {
  return {
    id: `evt-${event.aggregateId}`,
    type: event.name,
    version: 1,
    occurredAt: event.occurredAt.toISOString(),
    payload: { parcelId: event.aggregateId },
  };
}
