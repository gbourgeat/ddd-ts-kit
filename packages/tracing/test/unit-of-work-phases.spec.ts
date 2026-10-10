import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AggregateRoot, Command, CommandBus, DomainEventDispatcher, Repository, type DomainEvent } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule, type Application } from '@ddd-ts-kit/di';
import { resetTracingConfiguration, traceApplication } from '../src/index.js';
import { expectSpanTree, installTestTracing, type TestTracing } from '../src/testing.js';

class Parcel extends AggregateRoot {
  static of(id: string, fact: string): Parcel {
    const parcel = new Parcel(id);
    const event: DomainEvent = { name: `shipping.parcel.${fact}`, aggregateId: id, occurredAt: new Date(0) };

    parcel.record(event);

    return parcel;
  }
}

abstract class ParcelRepository extends Repository<Parcel> {}

class InMemoryParcelRepository implements ParcelRepository {
  async findById(): Promise<Parcel | undefined> {
    return undefined;
  }

  async save(): Promise<void> {}
}

class SendParcels extends Command<undefined> {}

class SendParcelsHandler {
  constructor(private readonly parcels: ParcelRepository) {}

  async execute(): Promise<undefined> {
    await this.parcels.save(Parcel.of('p1', 'sent'));
    await this.parcels.save(Parcel.of('p2', 'sent'));

    return undefined;
  }
}

/** What the composition root attaches: a tracked parcel for the first one sent, and a notice once committed. */
function anApplication(notify: (id: string) => Promise<void>): Application {
  const shipping = defineContextModule({
    name: 'shipping',
    register(builder) {
      builder.bind(ParcelRepository).toClass(InMemoryParcelRepository);
      builder.command(SendParcels).handledBy(SendParcelsHandler, [ParcelRepository]);
    },
    onStart({ resolve }) {
      const dispatcher = resolve(DomainEventDispatcher);

      dispatcher.on('shipping.parcel.sent', async (event) => {
        if (event.aggregateId === 'p1') await resolve(ParcelRepository).save(Parcel.of('t1', 'tracked'));
      });

      dispatcher.on('shipping.parcel.sent', (event) => notify(event.aggregateId), { phase: 'after-commit' });
    },
  });

  return createApplication({ modules: [kernelModule({ instrumentation: traceApplication() }), shipping] });
}

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

beforeEach(() => resetTracingConfiguration());

describe('the phases of a unit of work in a trace', () => {
  it('shows the saves, then the events before the commit, those their handlers recorded, then the after-commit phase', async () => {
    const notified: string[] = [];
    const app = anApplication(async (id) => void notified.push(id));

    await app.start();

    const trace = await tracing.traceOf(() => app.resolve(CommandBus).execute(new SendParcels()));

    expectSpanTree(trace, [
      {
        name: 'command SendParcels',
        children: [
          { name: 'repository ParcelRepository.save' },
          { name: 'repository ParcelRepository.save' },
          {
            name: 'unit-of-work before-commit',
            kind: 'INTERNAL',
            children: [
              { name: 'domain-event shipping.parcel.sent', children: [{ name: 'repository ParcelRepository.save' }] },
              { name: 'domain-event shipping.parcel.sent' },
            ],
          },
          { name: 'unit-of-work before-commit', children: [{ name: 'domain-event shipping.parcel.tracked' }] },
          {
            name: 'unit-of-work after-commit',
            kind: 'INTERNAL',
            children: [{ name: 'domain-event shipping.parcel.sent' }, { name: 'domain-event shipping.parcel.sent' }],
          },
        ],
      },
    ]);

    expect(notified).toEqual(['p1', 'p2']);
  });

  it('keeps the after-commit phase in the trace of the command when its handler fails, and the command succeeded', async () => {
    const app = anApplication(() => Promise.reject(new Error('mail server down')));

    await app.start();

    const trace = await tracing.traceOf(() => app.resolve(CommandBus).execute(new SendParcels()));
    const [command] = trace;

    expect(command?.attributes['app.outcome']).toBe('succeeded');
    expect(command?.children.map((span) => span.name).at(-1)).toBe('unit-of-work after-commit');
  });

  it('leaves the events under the save outside of a unit of work, without a phase span', async () => {
    const app = anApplication(async () => undefined);

    await app.start();

    const trace = await tracing.traceOf(() => app.resolve(ParcelRepository).save(Parcel.of('p2', 'sent')));

    expectSpanTree(trace, [
      {
        name: 'repository ParcelRepository.save',
        children: [{ name: 'domain-event shipping.parcel.sent' }, { name: 'domain-event shipping.parcel.sent' }],
      },
    ]);
  });
});
