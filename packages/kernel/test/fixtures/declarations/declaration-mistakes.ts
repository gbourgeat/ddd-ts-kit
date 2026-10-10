import {
  AuthorizedCommand,
  Clock,
  Command,
  IdGenerator,
  Query,
  type Actor,
  type CommandBus,
  type IntegrationEvent,
} from '../../../src/index.js';
import {
  Adapter,
  CommandHandler,
  DomainEventHandler,
  IntegrationEventHandler,
  On,
  Policy,
  Projection,
  Public,
  QueryHandler,
  Repository,
  Requires,
  Scheduled,
} from '../../../src/declarations.js';
import {
  PatientRegistered,
  InMemoryVisitRepository,
  PatientList,
  ScheduleVisit,
  VisitRepository,
  VisitScheduled,
  scheduleVisits,
  type Visit,
} from './declared-clinic.js';

/*
 * What the compiler refuses. Each case is a class the decorator must reject: the file compiles
 * only as long as every `@ts-expect-error` still meets an error.
 */

class CancelVisit extends AuthorizedCommand {}
class CountVisits extends Query<number> {}

// @ts-expect-error -- a handler of another message: it executes CancelVisit, not ScheduleVisit
@CommandHandler(ScheduleVisit, [VisitRepository, Clock])
export class HandlerOfAnotherMessage {
  constructor(
    readonly visits: VisitRepository,
    readonly clock: Clock,
  ) {}

  async execute(_command: CancelVisit): Promise<void> {}
}

// @ts-expect-error -- the wrong result: ScheduleVisit answers a string
@CommandHandler(ScheduleVisit)
export class HandlerWithAnotherResult {
  async execute(_command: ScheduleVisit): Promise<number> {
    return 1;
  }
}

// @ts-expect-error -- the wrong port: IdGenerator is not a Clock
@CommandHandler(ScheduleVisit, [VisitRepository, IdGenerator])
export class HandlerWithAWrongToken {
  constructor(
    readonly visits: VisitRepository,
    readonly clock: Clock,
  ) {}

  async execute(_command: ScheduleVisit): Promise<string> {
    return 'visit-1';
  }
}

// @ts-expect-error -- the tokens in the wrong order: the constructor takes the repository first
@CommandHandler(ScheduleVisit, [Clock, VisitRepository])
export class HandlerWithTokensOutOfOrder {
  constructor(
    readonly visits: VisitRepository,
    readonly clock: Clock,
  ) {}

  async execute(_command: ScheduleVisit): Promise<string> {
    return 'visit-1';
  }
}

// @ts-expect-error -- a class where its port is expected: the list names VisitRepository, not what implements it
@CommandHandler(ScheduleVisit, [InMemoryVisitRepository, Clock])
export class HandlerNamingAnAdapter {
  constructor(
    readonly visits: VisitRepository,
    readonly clock: Clock,
  ) {}

  async execute(_command: ScheduleVisit): Promise<string> {
    return 'visit-1';
  }
}

// @ts-expect-error -- no token list, and the constructor has parameters
@CommandHandler(ScheduleVisit)
export class HandlerWithoutItsList {
  constructor(readonly visits: VisitRepository) {}

  async execute(_command: ScheduleVisit): Promise<string> {
    return 'visit-1';
  }
}

// @ts-expect-error -- one token too many: the constructor takes one parameter
@CommandHandler(ScheduleVisit, [VisitRepository, Clock])
export class HandlerWithOneTokenTooMany {
  constructor(readonly visits: VisitRepository) {}

  async execute(_command: ScheduleVisit): Promise<string> {
    return 'visit-1';
  }
}

// @ts-expect-error -- one token missing: the constructor takes two parameters
@QueryHandler(CountVisits, [VisitRepository])
export class HandlerWithOneTokenMissing {
  constructor(
    readonly visits: VisitRepository,
    readonly clock: Clock,
  ) {}

  async execute(_query: CountVisits): Promise<number> {
    return 0;
  }
}

// @ts-expect-error -- a right is somebody's: a plain Command carries no actor
@Requires(scheduleVisits)
export class ProtectedWithoutActor extends Command {}

// @ts-expect-error -- an audited field the message does not have
@Public({ audited: ['reason'] })
export class AuditedWithoutTheField extends Command {}

// @ts-expect-error -- the class does not implement its port: findById is missing
@Repository(VisitRepository)
export class NotARepository {
  async save(_visit: Visit): Promise<void> {}
}

// @ts-expect-error -- an adapter of another port: a Clock is no VisitRepository
@Repository(VisitRepository)
export class ClockInPlaceOfARepository implements Clock {
  now(): Date {
    return new Date(0);
  }
}

// @ts-expect-error -- an abstract class cannot be bound
@Adapter(VisitRepository)
export abstract class AbstractRepository implements VisitRepository {
  abstract save(visit: Visit): Promise<void>;

  abstract findById(id: string): Promise<Visit | undefined>;
}

// @ts-expect-error -- a handler of another payload
@IntegrationEventHandler(PatientRegistered, { consumer: 'clinic.wrong-payload' })
export class HandlerOfAnotherPayload {
  readonly handle = async (_event: { readonly payload: { readonly orderId: string } }): Promise<void> => {};
}

export class HandlerWithoutAName {
  readonly handle = async (): Promise<void> => {};
}
// @ts-expect-error -- the consumer name is mandatory and cannot be empty
IntegrationEventHandler(PatientRegistered, { consumer: '' });
// @ts-expect-error -- the consumer name is mandatory
IntegrationEventHandler(PatientRegistered, {});

// @ts-expect-error -- a handler of another domain event
@DomainEventHandler(VisitScheduled, { name: 'clinic.visit.scheduled' })
export class HandlerOfAnotherDomainEvent {
  readonly handle = async (_event: { readonly name: 'clinic.visit.cancelled' }): Promise<void> => {};
}

// @ts-expect-error -- a policy answers a boolean or a verdict
@Policy(scheduleVisits, { name: 'clinic.answers-nothing' })
export class PolicyWithoutAnAnswer {
  allows(_actor: Actor): string {
    return 'yes';
  }
}

// @ts-expect-error -- a job runs: this class has no run method
@Scheduled('clinic.without-run', { every: '1h' })
export class JobWithoutRun {
  async execute(): Promise<void> {}
}

// @ts-expect-error -- run receives the execution, not a number
@Scheduled('clinic.another-run', { every: '1h' })
export class JobWithAnotherRun {
  async run(_times: number): Promise<void> {}
}

// @ts-expect-error -- no token list, and the constructor has parameters
@Scheduled('clinic.without-its-list', { every: '1h' })
export class JobWithoutItsList {
  constructor(readonly commands: CommandBus) {}

  async run(): Promise<void> {}
}

// @ts-expect-error -- the wrong port: Clock is not a CommandBus
@Scheduled('clinic.with-a-wrong-token', { cron: '0 7 * * *' }, [Clock])
export class JobWithAWrongToken {
  constructor(readonly commands: CommandBus) {}

  async run(): Promise<void> {}
}

// @ts-expect-error -- a job name is <context>.<job-name>
Scheduled('purge', { every: '1h' });
// @ts-expect-error -- one schedule, an interval or a cron, never both
Scheduled('clinic.both', { every: '1h', cron: '0 * * * *' });
// @ts-expect-error -- a time zone goes with a cron
Scheduled('clinic.zone-of-an-interval', { every: '1h', timeZone: 'Europe/Paris' });
// @ts-expect-error -- the schedule is mandatory
Scheduled('clinic.never', { overlap: 'skip' });
// @ts-expect-error -- a duration text carries its unit
Scheduled('clinic.without-unit', { every: '15' });
// @ts-expect-error -- an occurrence that overlaps is skipped or queued, nothing else
Scheduled('clinic.parallel', { every: '1h', overlap: 'parallel' });

@Projection('clinic.of-another-event', [PatientList])
export class ProjectionOfAnotherEvent {
  constructor(readonly patients: PatientList) {}

  // @ts-expect-error -- the method applies another payload than the event it is written on
  @On(PatientRegistered)
  async registered(_event: IntegrationEvent<{ readonly visitId: number }>): Promise<void> {}

  // @ts-expect-error -- the method applies an integration event, VisitScheduled is a domain event
  @On(VisitScheduled, { name: 'clinic.visit.scheduled' })
  async scheduled(_event: IntegrationEvent<{ readonly visitId: number }>): Promise<void> {}

  // @ts-expect-error -- a domain event is named
  @On(VisitScheduled)
  async unnamed(_event: VisitScheduled): Promise<void> {}
}

// @ts-expect-error -- the wrong port: Clock is not the read model of the projection
@Projection('clinic.with-a-wrong-token', [Clock])
export class ProjectionWithAWrongToken {
  constructor(readonly patients: PatientList) {}

  @On(PatientRegistered)
  async registered(_event: IntegrationEvent<{ readonly patientId: string }>): Promise<void> {}
}

// @ts-expect-error -- a projection name is <context>.<name>
Projection('patients');
