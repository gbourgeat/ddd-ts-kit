import type { EventBus, IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import { failureOf } from './failure-of';
import { tenantEnvelope } from './tenant-envelope';

export interface EventBusUnderContract {
  readonly bus: EventBus;
  /**
   * Resolves once everything published so far has been delivered (or given up on). Needed by
   * providers that deliver asynchronously; in-process buses leave it out.
   */
  settle?(): Promise<void>;
  close?(): Promise<void>;
}

export interface EventBusContractOptions {
  readonly name: string;
  /** A fresh bus with no subscriber; called before each test. */
  createBus(): Awaitable<EventBusUnderContract>;
}

/**
 * What every integration event provider guarantees. Delivery is at-least-once: the suite
 * accepts redeliveries everywhere and never relies on the order of arrival.
 */
export function eventBusContract(runner: ContractRunner, options: EventBusContractOptions): void {
  new EventBusSuite(runner, options).describe(`${options.name} (event bus contract)`);
}

const HAPPENED = 'contract.thing.happened';
const IGNORED = 'contract.thing.ignored';

class EventBusSuite extends ContractSuite<EventBusUnderContract> {
  constructor(runner: ContractRunner, options: EventBusContractOptions) {
    super(runner, () => options.createBus());
  }

  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    this.deliversToTheSubscribersOfTheType();
    this.stopsDeliveringOnceUnsubscribed();
    this.handsTheEnvelopeOverUntouched();
    this.survivesAFailingHandler();
  }

  private deliversToTheSubscribersOfTheType(): void {
    this.it('delivers an event to the subscribers of its type only', async () => {
      const happened = this.collect(HAPPENED);
      const ignored = this.collect(IGNORED);

      this.expect(await this.publish([busEvent('evt-1')])).toBe(undefined);

      this.expect(happened.ids()).toEqual(['evt-1']);
      this.expect(ignored.ids()).toEqual([]);
    });

    this.it('delivers to every subscriber of the type', async () => {
      const first = this.collect(HAPPENED);
      const second = this.collect(HAPPENED);

      await this.publish([busEvent('evt-1')]);

      this.expect(first.ids()).toEqual(['evt-1']);
      this.expect(second.ids()).toEqual(['evt-1']);
    });

    this.it('delivers every event of a batch', async () => {
      const happened = this.collect(HAPPENED);
      const ignored = this.collect(IGNORED);

      await this.publish([busEvent('evt-1'), busEvent('evt-2', IGNORED), busEvent('evt-3')]);

      this.expect(happened.ids()).toEqual(['evt-1', 'evt-3']);
      this.expect(ignored.ids()).toEqual(['evt-2']);
    });

    this.it('accepts an event nobody subscribed to', async () => {
      this.expect(await this.publish([busEvent('evt-1')])).toBe(undefined);
    });
  }

  private stopsDeliveringOnceUnsubscribed(): void {
    this.it('stops delivering to a handler once it is unsubscribed', async () => {
      const kept = this.collect(HAPPENED);
      const removed: string[] = [];

      const subscription = this.subject.bus.subscribe(HAPPENED, async (received) => {
        removed.push(received.id);
      });

      await this.publish([busEvent('evt-1')]);
      subscription.unsubscribe();
      const before = removed.length;

      await this.publish([busEvent('evt-2')]);

      this.expect(kept.ids()).toEqual(['evt-1', 'evt-2']);
      this.expect(removed.includes('evt-2')).toBe(false);
      this.expect(before > 0).toBe(true);
    });
  }

  private handsTheEnvelopeOverUntouched(): void {
    this.it('hands the envelope over exactly as published, trace, correlation and tenant included', async () => {
      const happened = this.collect(HAPPENED);
      const published = tenantEnvelope(busEvent('evt-1'));

      await this.publish([published]);

      this.expect(happened.events[0]).toEqual(published);
    });

    this.it('does not invent a trace or a correlation when none was published', async () => {
      const happened = this.collect(HAPPENED);

      await this.publish([busEvent('evt-1')]);

      this.expect(happened.events[0]).toEqual(busEvent('evt-1'));
      this.expect(happened.events[0]?.traceparent).toBe(undefined);
      this.expect(happened.events[0]?.correlationId).toBe(undefined);
      this.expect(happened.events[0]?.tenantId).toBe(undefined);
    });
  }

  private survivesAFailingHandler(): void {
    this.it('surfaces the failure of a handler without starving the other subscribers', async () => {
      let attempts = 0;

      this.subject.bus.subscribe(HAPPENED, async () => {
        attempts += 1;

        if (attempts === 1) {
          throw new Error('handler failed');
        }
      });

      const healthy = this.collect(HAPPENED);

      const failure = await this.publish([busEvent('evt-1')]);

      // Either the publication is rejected (in-process) or the event comes back (broker).
      this.expect(failure !== undefined || attempts > 1).toBe(true);
      this.expect(healthy.ids()).toEqual(['evt-1']);
    });
  }

  /** Subscribes and returns the distinct ids received, which is what at-least-once allows to assert. */
  private collect(type: string): { ids(): string[]; events: IntegrationEvent[] } {
    const events: IntegrationEvent[] = [];

    this.subject.bus.subscribe(type, async (received) => {
      events.push(received);
    });

    return { events, ids: () => [...new Set(events.map((received) => received.id))].sort() };
  }

  private async publish(events: readonly IntegrationEvent[]): Promise<unknown> {
    const failure = await failureOf(() => this.subject.bus.publish(events));

    await this.subject.settle?.();

    return failure;
  }
}

function busEvent(id: string, type = HAPPENED): IntegrationEvent {
  return {
    id,
    type,
    version: 1,
    occurredAt: '2026-03-01T10:00:00.000Z',
    payload: { thingId: `thing-${id}` },
  };
}
