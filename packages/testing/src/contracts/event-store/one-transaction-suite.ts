import {
  InMemoryDomainEventDispatcher,
  dispatchingOnSave,
  type DomainEvent,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';
import { Consignment } from './consignment';
import { Consignments } from './consignments';
import type { EventStoreUnderContract } from './event-store-under-contract';

const LATER = new Date('2100-01-01T00:00:00.000Z');

class TruckLost extends Error {}

/**
 * No double write: the events of an aggregate and the integration events published for them are
 * written by one transaction. The store is fed by the save; the publisher, a handler of the domain
 * events run before the commit, feeds the outbox: both commit, or neither does.
 */
export class OneTransactionSuite extends ContractSuite<EventStoreUnderContract> {
  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    this.commitsTogether();
    this.publishesNothingRefused();
  }

  private commitsTogether(): void {
    this.it('commits the stream and the outbox records published for its events together', async () => {
      const consignments = this.publishing();

      await this.subject.unitOfWork.run(() => consignments.save(Consignment.register('c1').weigh(300)));

      this.expect((await this.subject.store.readStream('shipping.consignment-c1')).length).toBe(2);

      this.expect(await this.relayed()).toEqual([
        'shipping.consignment.registered c1',
        'shipping.consignment.weighed c1',
      ]);
    });

    this.it('leaves nothing in the outbox for an append that was rolled back', async () => {
      const consignments = this.publishing();

      const failure = await failureOf(() =>
        this.subject.unitOfWork.run(async () => {
          await consignments.save(Consignment.register('c1'));
          throw new TruckLost();
        }),
      );

      this.expect(failure instanceof TruckLost).toBe(true);
      this.expect(await this.subject.store.readStream('shipping.consignment-c1')).toEqual([]);
      this.expect((await this.subject.outbox.stats()).pending).toBe(0);
      this.expect(await this.relayed()).toEqual([]);
    });
  }

  private publishesNothingRefused(): void {
    this.it('publishes nothing for an append refused by a concurrency conflict', async () => {
      const consignments = this.publishing();

      await this.subject.unitOfWork.run(() => consignments.save(Consignment.register('c1')));

      const stale = await loaded(consignments, 'c1');
      const winner = await loaded(consignments, 'c1');

      await this.subject.unitOfWork.run(() => consignments.save(winner.weigh(100)));

      const refused = await failureOf(() => this.subject.unitOfWork.run(() => consignments.save(stale.weigh(200))));

      this.expect(refused === undefined).toBe(false);

      this.expect((await this.subject.store.readStream('shipping.consignment-c1')).length).toBe(2);
      this.expect((await this.relayed()).length).toBe(2);
    });
  }

  private published = 0;

  /** The repository of the composition root: events leave with the save, and the publisher writes to the outbox before the commit. */
  private publishing(): Consignments {
    const dispatcher = new InMemoryDomainEventDispatcher();

    const publish = async (event: DomainEvent): Promise<void> =>
      this.subject.outbox.append([this.integrationOf(event)]);

    dispatcher.on('shipping.consignment.registered', publish, { phase: 'before-commit' });
    dispatcher.on('shipping.consignment.weighed', publish, { phase: 'before-commit' });

    return dispatchingOnSave(new Consignments(this.subject.store), () => dispatcher);
  }

  private integrationOf(event: DomainEvent): IntegrationEvent {
    this.published += 1;

    return {
      id: `evt-${this.published}`,
      type: event.name,
      version: 1,
      occurredAt: event.occurredAt.toISOString(),
      payload: { consignmentId: event.aggregateId },
    };
  }

  private async relayed(): Promise<string[]> {
    return (await this.subject.outbox.claimBatch(100, LATER)).map(
      ({ event }) => `${event.type} ${idOf(event.payload)}`,
    );
  }
}

async function loaded(consignments: Consignments, id: string): Promise<Consignment> {
  const consignment = await consignments.findById(id);

  if (consignment === undefined) {
    throw new Error(`Consignment ${id} was saved and is not found`);
  }

  return consignment;
}

function idOf(payload: unknown): string {
  return typeof payload === 'object' && payload !== null && 'consignmentId' in payload
    ? String(payload.consignmentId)
    : '';
}
