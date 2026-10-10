import { describe, expect, it } from 'vitest';
import {
  Command,
  CommandBus,
  EventBus,
  ExecutionScope,
  IntegrationEventSubscriber,
  ProcessedEventStore,
  UnitOfWork,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import {
  createApplication,
  createTestApplication,
  defineContextModule,
  fake,
  kernelModule,
  overrideForTests,
  type ContextModule,
} from '../src/index.js';
import { RecordingSubscriber } from './support/fakes/recording-subscriber.js';
import { ReleasingProcessedEvents } from './support/fakes/releasing-processed-events.js';
import { TransactionalJournal } from './support/fakes/transactional-journal.js';
import { TransactionalProcessedEvents } from './support/fakes/transactional-processed-events.js';
import { TransactionalUnitOfWork } from './support/fakes/transactional-unit-of-work.js';
import { orderPlaced } from './support/ordering/published-language/order-placed-event.js';
import { OrderPlaced } from './support/ordering/published-language/order-placed.js';

const CONSUMER = 'billing.invoice-on-order-placed';
const placed = (id: string, orderId = 'order-1'): IntegrationEvent => orderPlaced(id, { orderId, sku: 'book' });

/** The handler under test: it writes a line to the ledger, then fails while the order is refused. */
function billing(ledger: { write(line: string): void }, refused: Set<string> = new Set()): ContextModule {
  return defineContextModule({
    name: 'billing',
    register(builder) {
      builder.on(OrderPlaced, { consumer: CONSUMER }).handledByFactory(() => ({
        handle: async (event) => {
          ledger.write(`invoice for ${event.payload.orderId}`);

          if (refused.has(event.payload.orderId)) {
            throw new RangeError(`cannot invoice ${event.payload.orderId}`);
          }
        },
      }));
    },
  });
}

/** A database as the handler sees it: a ledger and the processed events, in one unit of work. */
function database() {
  const ledger = new TransactionalJournal('A ledger line');
  const processed = new TransactionalProcessedEvents();
  const unitOfWork = new TransactionalUnitOfWork([ledger, processed]);

  return { ledger, processed, unitOfWork, kernel: kernelModule({ unitOfWork, processedEvents: processed }) };
}

describe('an integration event handler, with a unit of work and a processed-event store', () => {
  it('marks the event and does its work in the same unit of work', async () => {
    const { ledger, processed, unitOfWork, kernel } = database();
    const app = createApplication({ modules: [kernel, billing(ledger)] });

    await app.start();

    await app.resolve(EventBus).publish([placed('event-1')]);

    expect(unitOfWork.outcomes).toEqual(['committed']);
    expect(processed.lines()).toEqual([`${CONSUMER} event-1`]);
    expect(ledger.lines()).toEqual(['invoice for order-1']);
  });

  it('leaves no mark when the handler fails, so the redelivery is handled', async () => {
    const { ledger, processed, unitOfWork, kernel } = database();
    const refused = new Set(['order-1']);
    const app = createApplication({ modules: [kernel, billing(ledger, refused)] });

    await app.start();

    await expect(app.resolve(EventBus).publish([placed('event-1')])).rejects.toMatchObject({
      errors: [{ message: 'cannot invoice order-1' }],
    });

    expect(unitOfWork.outcomes).toEqual(['rolled back']);
    expect(processed.lines()).toEqual([]);
    expect(ledger.lines()).toEqual([]);

    refused.clear();
    await app.resolve(EventBus).publish([placed('event-1')]);

    expect(unitOfWork.outcomes).toEqual(['rolled back', 'committed']);
    expect(processed.lines()).toEqual([`${CONSUMER} event-1`]);
    expect(ledger.lines()).toEqual(['invoice for order-1']);
  });

  it('marks once when the handler succeeds, and skips the redelivery', async () => {
    const { ledger, processed, unitOfWork, kernel } = database();
    const app = createApplication({ modules: [kernel, billing(ledger)] });

    await app.start();

    await app.resolve(EventBus).publish([placed('event-1')]);
    await app.resolve(EventBus).publish([placed('event-1')]);

    expect(processed.lines()).toEqual([`${CONSUMER} event-1`]);
    expect(ledger.lines()).toEqual(['invoice for order-1']);
    expect(unitOfWork.outcomes).toEqual(['committed', 'committed']);
  });

  it('opens the unit of work inside the execution scope of the event', async () => {
    const ledger = new TransactionalJournal('A ledger line');
    const processed = new TransactionalProcessedEvents();
    const origins: (string | undefined)[] = [];

    const kernel = kernelModule({
      processedEvents: processed,
      unitOfWork: (resolve) =>
        new TransactionalUnitOfWork([ledger, processed], () => {
          const context = resolve(ExecutionScope).current();

          origins.push(`${context?.origin} ${context?.causationId} as ${context?.actor.id}`);
        }),
    });

    const app = createApplication({ modules: [kernel, billing(ledger)] });

    await app.start();

    await app.resolve(EventBus).publish([placed('event-1')]);

    expect(origins).toEqual([`event event-1 as system:${CONSUMER}`]);
  });
});

describe('the unit of work of an integration event handler', () => {
  it('shares its unit of work with the command it sends: one transaction, not two', async () => {
    class IssueInvoice extends Command {
      constructor(readonly orderId: string) {
        super();
      }
    }
    const { ledger, processed, unitOfWork, kernel } = database();

    const sending = defineContextModule({
      name: 'billing',
      register(builder) {
        builder.command(IssueInvoice).handledByFactory(() => ({
          execute: async (command) => {
            ledger.write(`invoice for ${command.orderId}`);

            throw new RangeError('the command fails after its write');
          },
        }));

        builder.on(OrderPlaced, { consumer: CONSUMER }).handledByFactory((resolve) => ({
          handle: (event) => resolve(CommandBus).execute(new IssueInvoice(event.payload.orderId)),
        }));
      },
    });

    const app = createApplication({ modules: [kernel, sending] });

    await app.start();

    await expect(app.resolve(EventBus).publish([placed('event-1')])).rejects.toBeInstanceOf(AggregateError);

    expect(unitOfWork.outcomes).toEqual(['rolled back']);
    expect(processed.lines()).toEqual([]);
    expect(ledger.lines()).toEqual([]);
  });

  it('resolves the unit of work at each event: one swapped in after the start is the one that runs', async () => {
    const { ledger, processed, unitOfWork, kernel } = database();
    const later = new TransactionalUnitOfWork([ledger, processed]);
    const app = createApplication({ modules: [kernel, billing(ledger)] });

    await app.start();

    overrideForTests(app, UnitOfWork, later);
    await app.resolve(EventBus).publish([placed('event-1')]);

    expect(unitOfWork.outcomes).toEqual([]);
    expect(later.outcomes).toEqual(['committed']);
  });

  it('holds in a test application, whose unit of work and store a spec fakes', async () => {
    const ledger = new TransactionalJournal('A ledger line');
    const processed = new TransactionalProcessedEvents();
    const unitOfWork = new TransactionalUnitOfWork([ledger, processed]);
    const refused = new Set(['order-1']);

    const app = createTestApplication({
      modules: [billing(ledger, refused)],
      fakes: [fake(UnitOfWork, unitOfWork), fake(ProcessedEventStore, processed)],
    });

    await app.start();

    await expect(app.eventBus.publish([placed('event-1')])).rejects.toBeInstanceOf(AggregateError);
    refused.clear();
    await app.eventBus.publish([placed('event-1')]);
    await app.eventBus.publish([placed('event-1')]);

    expect(unitOfWork.outcomes).toEqual(['rolled back', 'committed', 'committed']);
    expect(ledger.lines()).toEqual(['invoice for order-1']);
  });
});

describe('an integration event handler, without a unit of work', () => {
  /** No kernel module: only what a consumer needs, and no `UnitOfWork`. */
  function platform(subscriber: RecordingSubscriber, processed: ProcessedEventStore): ContextModule {
    return defineContextModule({
      name: 'platform',
      register(builder) {
        builder.bind(IntegrationEventSubscriber).toValue(subscriber);
        builder.bind(ProcessedEventStore).toValue(processed);
      },
    });
  }

  it('gives its mark back when the handler fails and the store can release it', async () => {
    const subscriber = new RecordingSubscriber();
    const processed = new ReleasingProcessedEvents();
    const handled: string[] = [];
    const refused = new Set(['order-1']);

    const app = createApplication({
      modules: [platform(subscriber, processed), billing({ write: (line) => void handled.push(line) }, refused)],
    });

    await app.start();

    await expect(subscriber.deliver(placed('event-1'))).rejects.toThrow('cannot invoice order-1');

    expect(processed.released).toEqual([`${CONSUMER} event-1`]);
    expect([...processed.marks]).toEqual([]);

    refused.clear();
    await subscriber.deliver(placed('event-1'));
    await subscriber.deliver(placed('event-1'));

    expect(handled).toEqual(['invoice for order-1', 'invoice for order-1']);
    expect([...processed.marks]).toEqual([`${CONSUMER} event-1`]);
  });

  it('keeps the mark of a failed handler when the store cannot release it: the redelivery is skipped', async () => {
    const subscriber = new RecordingSubscriber();
    const marks = new Set<string>();

    const processed: ProcessedEventStore = {
      markProcessed: async (consumer, eventId) => marks.size < marks.add(`${consumer} ${eventId}`).size,
    };

    const handled: string[] = [];
    const refused = new Set(['order-1']);

    const app = createApplication({
      modules: [platform(subscriber, processed), billing({ write: (line) => void handled.push(line) }, refused)],
    });

    await app.start();

    await expect(subscriber.deliver(placed('event-1'))).rejects.toThrow('cannot invoice order-1');
    refused.clear();
    await subscriber.deliver(placed('event-1'));

    expect(handled).toEqual(['invoice for order-1']);
  });

  it('refuses a transactional store: its mark has no unit of work to be written in', async () => {
    const subscriber = new RecordingSubscriber();

    const app = createApplication({
      modules: [platform(subscriber, new TransactionalProcessedEvents()), billing({ write: () => {} })],
    });

    await app.start();

    await expect(subscriber.deliver(placed('event-1'))).rejects.toThrow(
      `A processed-event mark written outside a unit of work: ${CONSUMER} event-1`,
    );
  });
});
