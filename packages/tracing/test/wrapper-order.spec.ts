import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AggregateRoot, Command, CommandBus, DomainEventDispatcher, Repository, type DomainEvent } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule, type Application, type BindingAspect } from '@ddd-ts-kit/di';
import { resetTracingConfiguration, traceApplication } from '../src/index.js';
import { expectSpanTree, installTestTracing, type ExpectedSpan, type TestTracing } from '../src/testing.js';

class Parcel extends AggregateRoot {
  static sent(id: string): Parcel {
    const parcel = new Parcel(id);
    const event: DomainEvent = { name: 'shipping.parcel.sent', aggregateId: id, occurredAt: new Date(0) };

    parcel.record(event);

    return parcel;
  }
}

abstract class ParcelRepository extends Repository<Parcel> {}

class FlakyParcelRepository implements ParcelRepository {
  failures = 0;

  saves = 0;

  async findById(): Promise<Parcel | undefined> {
    return undefined;
  }

  async save(): Promise<void> {
    this.saves += 1;

    if (this.failures > 0) {
      this.failures -= 1;

      throw Object.assign(new Error('deadlock detected'), { code: 'ETIMEDOUT' });
    }
  }
}

class SendParcel extends Command<undefined> {}

class SendParcelHandler {
  constructor(private readonly parcels: ParcelRepository) {}

  async execute(): Promise<undefined> {
    await this.parcels.save(Parcel.sent('p1'));

    return undefined;
  }
}

/** A retry written as a binding aspect: the method again, once, after a failure. */
const retryingOnce: BindingAspect = (instance) => {
  const save: unknown = Reflect.get(instance, 'save');

  if (typeof save !== 'function') return instance;

  Reflect.set(instance, 'save', async (...args: unknown[]): Promise<unknown> => {
    try {
      return await Reflect.apply(save, instance, args);
    } catch {
      return Reflect.apply(save, instance, args);
    }
  });

  return instance;
};

function anApplication(repository: FlakyParcelRepository, handled: string[]): Application {
  const shipping = defineContextModule({
    name: 'shipping',
    register(builder) {
      builder.bind(ParcelRepository).toValue(repository).with(retryingOnce);
      builder.command(SendParcel).handledBy(SendParcelHandler, [ParcelRepository]);
    },
    onStart({ resolve }) {
      resolve(DomainEventDispatcher).on('shipping.parcel.sent', async (event) => void handled.push(event.aggregateId));
    },
  });

  return createApplication({ modules: [kernelModule({ instrumentation: traceApplication() }), shipping] });
}

const sending: ExpectedSpan = {
  name: 'command SendParcel',
  children: [
    { name: 'repository ParcelRepository.save' },
    { name: 'unit-of-work before-commit', kind: 'INTERNAL', children: [{ name: 'domain-event shipping.parcel.sent' }] },
  ],
};

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

beforeEach(() => resetTracingConfiguration());

describe('the wrappers of a repository, outermost first: the span, the dispatch, the aspects of the binding', () => {
  it('shows one save, retries included, then the event it recorded at the end of the unit of work, dispatched once', async () => {
    const repository = new FlakyParcelRepository();
    const handled: string[] = [];
    const app = anApplication(repository, handled);

    repository.failures = 1;
    await app.start();

    const trace = await tracing.traceOf(() => app.resolve(CommandBus).execute(new SendParcel()));

    expectSpanTree(trace, [sending]);
    expect(repository.saves).toBe(2);
    expect(handled).toEqual(['p1']);
  });

  it('holds for a sealed repository, which each wrapper reaches through a proxy', async () => {
    const repository = Object.seal(new FlakyParcelRepository());
    const handled: string[] = [];
    const app = anApplication(repository, handled);

    await app.start();

    const trace = await tracing.traceOf(() => app.resolve(CommandBus).execute(new SendParcel()));

    expectSpanTree(trace, [sending]);
    expect(handled).toEqual(['p1']);
  });

  it('shows the save failed, and no event, when the save fails for good', async () => {
    const repository = new FlakyParcelRepository();
    const handled: string[] = [];
    const app = anApplication(repository, handled);

    repository.failures = 2;
    await app.start();

    const trace = await tracing.traceOf(() => app.resolve(CommandBus).execute(new SendParcel()).catch(() => undefined));

    expectSpanTree(trace, [
      { name: 'command SendParcel', status: 'ERROR', children: [{ name: 'repository ParcelRepository.save', status: 'ERROR', attributes: { 'app.error.code': 'ETIMEDOUT' } }] },
    ]);

    expect(handled).toEqual([]);
  });
});
