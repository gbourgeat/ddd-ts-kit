import { describe, expect, it } from 'vitest';
import {
  executionContext,
  scopedPublisher,
  systemActor,
  type Actor,
  type ExecutionContext,
  type IntegrationEvent,
  type Session,
} from '@ddd-ts-kit/kernel';
import {
  ACTOR_CONTEXT,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EXECUTION_SCOPE,
  createApplication,
  createTestApplication,
  defineContextModule,
  kernelModule,
} from '../src/index.js';
import { OrderPlaced, PlaceOrder, orderPlaced, orderingModule } from './support/ordering.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['accountant'], attributes: {} };
const bob: Actor = { id: 'bob', type: 'user', roles: ['clerk'], attributes: {} };

const adaSession: Session = {
  id: 'session-1',
  actor: ada,
  issuedAt: new Date('2026-01-01T00:00:00.000Z'),
  authenticationMethod: 'sso',
  impersonatedBy: 'support-7',
  extensions: {},
};

/** A consumer that keeps the execution context infrastructure would see while it handles. */
function auditing(seen: (ExecutionContext | undefined)[], actorOf?: (event: IntegrationEvent) => Actor | undefined) {
  return defineContextModule({
    name: 'audit',
    register(builder) {
      builder
        .on(OrderPlaced, { consumer: 'audit.order-placed', ...(actorOf === undefined ? {} : { actorOf }) })
        .handledByFactory((resolve) => ({
          handle: async () => void seen.push(resolve(EXECUTION_SCOPE).current()),
        }));
    },
  });
}

const placed = (id: string, correlationId?: string): IntegrationEvent => ({
  ...orderPlaced(id, { orderId: 'order-1', sku: 'book' }),
  ...(correlationId === undefined ? {} : { correlationId }),
});

describe('a consumer declared with builder.on', () => {
  it('handles each event in the execution scope: origin event, its correlation, the event as cause', async () => {
    const seen: (ExecutionContext | undefined)[] = [];
    const app = createApplication({ modules: [kernelModule(), auditing(seen)] });
    await app.start();

    await app.resolve(EVENT_BUS).publish([placed('event-1', 'corr-1'), placed('event-2')]);

    expect(seen).toEqual([
      {
        correlationId: 'corr-1',
        causationId: 'event-1',
        actor: systemActor('audit.order-placed'),
        origin: 'event',
        extensions: {},
      },
      {
        correlationId: 'event-2',
        causationId: 'event-2',
        actor: systemActor('audit.order-placed'),
        origin: 'event',
        extensions: {},
      },
    ]);
    expect(app.resolve(EXECUTION_SCOPE).current()).toBeUndefined();
  });

  it('is the current actor of infrastructure while it handles', async () => {
    const actors: (string | undefined)[] = [];
    const reading = defineContextModule({
      name: 'reading',
      register(builder) {
        builder.on(OrderPlaced, { consumer: 'reading.order-placed' }).handledByFactory((resolve) => ({
          handle: async () => void actors.push(resolve(ACTOR_CONTEXT).current()?.id),
        }));
      },
    });
    const app = createApplication({ modules: [kernelModule(), reading] });
    await app.start();

    await app.resolve(EVENT_BUS).publish([placed('event-1')]);

    expect(actors).toEqual(['system:reading.order-placed']);
  });

  it('acts as the actor the project reads from its own envelope', async () => {
    const seen: (ExecutionContext | undefined)[] = [];
    const app = createApplication({ modules: [kernelModule(), auditing(seen, () => ada)] });
    await app.start();

    await app.resolve(EVENT_BUS).publish([placed('event-1')]);

    expect(seen).toMatchObject([{ actor: ada, tenantId: 'acme' }]);
  });

  it('continues the correlation of the command that published the event, through a scoped publisher', async () => {
    const seen: (ExecutionContext | undefined)[] = [];
    const kernel = kernelModule({
      eventPublisher: (resolve) => scopedPublisher(resolve(EVENT_BUS), resolve(EXECUTION_SCOPE)),
    });
    const app = createApplication({ modules: [kernel, orderingModule, auditing(seen)] });
    await app.start();
    const request = executionContext({ correlationId: 'corr-7', actor: ada, origin: 'http' });

    await app.resolve(EXECUTION_SCOPE).run(request, () => app.resolve(EVENT_PUBLISHER).publish([placed('event-1')]));

    expect(seen).toMatchObject([{ correlationId: 'corr-7', causationId: 'event-1', origin: 'event' }]);
  });

  it('handles events in the scope of a test application too, and gives the test its actor back', async () => {
    const seen: (ExecutionContext | undefined)[] = [];
    const app = createTestApplication({ modules: [orderingModule, auditing(seen)], actor: ada });
    await app.start();

    await app.commandBus.execute(new PlaceOrder('book'));

    expect(seen).toMatchObject([{ origin: 'event', actor: systemActor('audit.order-placed') }]);
    expect(app.actorContext.require()).toBe(ada);
    expect(app.executionScope.require()).toMatchObject({ origin: 'test', actor: ada });
  });
});

describe('createTestApplication', () => {
  it('sees the session it is given, and its actor as the current actor', () => {
    const app = createTestApplication({ modules: [], session: adaSession });

    expect(app.executionScope.require()).toMatchObject({
      correlationId: 'test-correlation',
      origin: 'test',
      actor: ada,
      session: adaSession,
      tenantId: 'acme',
    });
    expect(app.actorContext.require()).toBe(ada);
  });

  it('sees the whole execution context it is given', () => {
    const context = executionContext({
      correlationId: 'corr-1',
      actor: ada,
      origin: 'schedule',
      deadline: new Date('2026-01-01T00:00:05.000Z'),
    });

    const app = createTestApplication({ modules: [], executionContext: context, actor: bob });

    expect(app.executionScope.require()).toBe(context);
    expect(app.actorContext.require()).toBe(ada);
  });
});

describe('app.as', () => {
  it('runs a block as another actor, handed to the block, then comes back', async () => {
    const app = createTestApplication({ modules: [orderingModule], actor: ada });

    const seen = await app.as(bob, async (actor) => ({
      handed: actor,
      ambient: app.actorContext.require(),
      context: app.executionScope.require(),
    }));

    expect(seen.handed).toBe(bob);
    expect(seen.ambient).toBe(bob);
    expect(seen.context).toMatchObject({ actor: bob, correlationId: 'test-correlation', tenantId: 'acme' });
    expect(app.actorContext.require()).toBe(ada);
  });

  it('runs a block in a session, impersonation included', () => {
    const app = createTestApplication({ modules: [], actor: bob });

    const context = app.as(adaSession, () => app.executionScope.require());

    expect(context).toMatchObject({ actor: ada, session: adaSession, tenantId: 'acme' });
    expect(app.executionScope.require().session).toBeUndefined();
  });

  it('leaves the session of the application behind when acting as a bare actor', () => {
    const app = createTestApplication({ modules: [], session: adaSession });

    expect(app.as(bob, () => app.executionScope.require().session)).toBeUndefined();
    expect(app.executionScope.require().session).toBe(adaSession);
  });

  it('comes back to the previous actor when the block fails', async () => {
    const app = createTestApplication({ modules: [], actor: ada });

    await expect(app.as(bob, async () => Promise.reject(new Error('refused')))).rejects.toThrow('refused');

    expect(app.actorContext.require()).toBe(ada);
  });
});
