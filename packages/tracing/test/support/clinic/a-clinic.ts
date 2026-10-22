import {
  CommandBus,
  ErrorReporter,
  ExecutionScope,
  FixedClock,
  InMemoryCommandBus,
  InMemoryErrorReporter,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryLogger,
  JobScheduler,
  Logger,
  Metrics,
  QueryBus,
  SequentialIdGenerator,
  scopedPublisher,
  type EventBus,
} from '@ddd-ts-kit/kernel';
import { InMemoryAuditTrail, auditMiddleware } from '@ddd-ts-kit/audit';
import {
  UseCaseGuard,
  createApplication,
  defineContextModule,
  kernelModule,
  type Application,
  type ContextModule,
} from '@ddd-ts-kit/di';
import { InMemoryOutboxStore, OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import {
  ForbiddenError,
  defineRoute,
  executeRoute,
  reportHttpErrors,
  type Route,
  type RouteResponse,
} from '@ddd-ts-kit/http';
import { reportFailedRuns } from '@ddd-ts-kit/scheduling';
import { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';
import { traceApplication, tracedPublisher, tracedRoutes, type ConsumerTrace } from '../../../src';
import { analyticsModule, notificationModule } from './downstream';
import { BookAppointment, GetAppointment, schedulingModule } from './scheduling';

export interface ClinicOptions {
  /** Default: the in-memory bus of the kernel. */
  readonly bus?: EventBus;
  readonly consumers?: ConsumerTrace;
}

export interface Clinic {
  readonly app: Application;
  readonly store: InMemoryOutboxStore;
  readonly relay: OutboxRelay;
  readonly scheduler: ManualJobScheduler;
  readonly logger: InMemoryLogger;
  readonly errors: InMemoryErrorReporter;
  readonly audit: InMemoryAuditTrail;
  /** `POST /appointments` through the HTTP pipeline of the kit. */
  book(slot: string): Promise<RouteResponse>;
  /** `GET /appointments/:id`. */
  read(id: string): Promise<RouteResponse>;
}

const AT = new Date('2026-03-02T09:00:00.000Z');

/** Refuses to book the slot `forbidden`, as an authorization module would refuse a permission. */
const guardModule = defineContextModule({
  name: 'access',
  register(builder) {
    builder.bind(UseCaseGuard).toValue({
      check: async (message, next) => {
        if (message instanceof BookAppointment && message.slot === 'forbidden') {
          throw new ForbiddenError('booking is not allowed');
        }

        return next();
      },
    });
  },
});

/**
 * The scenario of the README, whole: three bounded contexts on the kernel, an outbox with its
 * relay, the HTTP pipeline, a scheduled job, an audit trail and an error tracker, all in
 * memory and all traced the way an application is: `kernelModule({ instrumentation })`.
 */
export async function aClinic(options: ClinicOptions = {}): Promise<Clinic> {
  const clock = new FixedClock(AT);
  const bus = options.bus ?? new InMemoryEventBus();
  const store = new InMemoryOutboxStore();
  const logger = new InMemoryLogger();
  const errors = new InMemoryErrorReporter();
  const audit = new InMemoryAuditTrail();
  const app = createApplication({ modules: modulesOf({ clock, bus, store, logger, errors }, options) });
  const scope = app.resolve(ExecutionScope);
  const commands = app.resolve(CommandBus);
  const routes = routesOf(app);

  const execute = {
    executionScope: scope,
    around: tracedRoutes(),
    onError: reportHttpErrors(app.resolve(ErrorReporter)),
  };

  if (commands instanceof InMemoryCommandBus) {
    commands.use(auditMiddleware(audit, { scope, clock, ids: new SequentialIdGenerator('audit') }));
  }

  await app.start();

  return {
    app,
    store,
    relay: new OutboxRelay({ store, publisher: tracedPublisher(bus), clock }),
    scheduler: jobSchedulerOf(app),
    logger,
    errors,
    audit,
    book: (slot) =>
      executeRoute(routes.book, { params: {}, query: {}, headers: {}, body: undefined, raw: { slot } }, execute),
    read: (id) =>
      executeRoute(routes.read, { params: {}, query: {}, headers: {}, body: undefined, raw: { id } }, execute),
  };
}

interface Parts {
  readonly clock: FixedClock;
  readonly bus: EventBus;
  readonly store: InMemoryOutboxStore;
  readonly logger: InMemoryLogger;
  readonly errors: InMemoryErrorReporter;
}

function modulesOf({ clock, bus, store, logger, errors }: Parts, options: ClinicOptions): ContextModule[] {
  const kernel = kernelModule({
    instrumentation: traceApplication(options.consumers === undefined ? {} : { consumers: options.consumers }),
    clock,
    ids: new SequentialIdGenerator('id'),
    eventBus: bus,
    eventPublisher: (resolve) => scopedPublisher(new OutboxPublisher(store), resolve(ExecutionScope)),
    logger,
    errorReporter: errors,
    jobScheduler: (resolve) =>
      new ManualJobScheduler({
        clock,
        lock: new InMemoryLock(clock),
        scope: resolve(ExecutionScope),
        ids: new SequentialIdGenerator('run'),
        logger: resolve(Logger),
        metrics: resolve(Metrics),
        onRun: reportFailedRuns(resolve(ErrorReporter)),
      }),
  });

  return [kernel, guardModule, schedulingModule, notificationModule(), analyticsModule];
}

function jobSchedulerOf(app: Application): ManualJobScheduler {
  const scheduler = app.resolve(JobScheduler);

  if (!(scheduler instanceof ManualJobScheduler)) {
    throw new TypeError('The clinic runs its jobs on the manual scheduler.');
  }

  return scheduler;
}

function routesOf(app: Application): { book: Route; read: Route } {
  const book = defineRoute(
    {
      method: 'POST',
      path: '/appointments',
      operationId: 'bookAppointment',
      summary: 'Book',
      responses: { 201: { description: 'Booked.' } },
      security: false,
    },
    async ({ context }) => {
      const id = await app.resolve(CommandBus).execute(new BookAppointment(slotOf(context.raw)));

      return { status: 201, headers: { location: `/appointments/${id}` } };
    },
  );

  const read = defineRoute(
    {
      method: 'GET',
      path: '/appointments/:id',
      operationId: 'getAppointment',
      summary: 'Read',
      responses: { 204: { description: 'Found.' } },
      security: false,
    },
    async ({ context }) => {
      await app.resolve(QueryBus).execute(new GetAppointment(slotOf(context.raw)));

      return { status: 204 };
    },
  );

  return { book, read };
}

/** The raw request of these routes is the object the spec handed to the pipeline. */
function slotOf(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) {
    return '';
  }

  const value: unknown = Reflect.get(raw, 'slot') ?? Reflect.get(raw, 'id');

  return typeof value === 'string' ? value : '';
}
