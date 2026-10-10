import { AuthorizedCommand, Command, Query, type Actor, type Clock, type CommandBus } from '../../../src/index.js';
import {
  Adapter,
  CLOCK,
  CommandHandler,
  DomainEventHandler,
  IntegrationEventHandler,
  ID_GENERATOR,
  Policy,
  Public,
  QueryHandler,
  Repository,
  Requires,
  Scheduled,
} from '../../../src/declarations.js';
import {
  PatientRegistered,
  ScheduleVisit,
  VISITS,
  VisitScheduled,
  scheduleVisits,
  type Visit,
  type VisitRepository,
} from './declared-clinic.js';

/*
 * What the compiler refuses. Each case is a class the decorator must reject: the file compiles
 * only as long as every `@ts-expect-error` still meets an error.
 */

class CancelVisit extends AuthorizedCommand {}
class CountVisits extends Query<number> {}

// @ts-expect-error -- a handler of another message: it executes CancelVisit, not ScheduleVisit
@CommandHandler(ScheduleVisit, [VISITS, CLOCK])
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

// @ts-expect-error -- a token of the wrong type: ID_GENERATOR does not resolve to a Clock
@CommandHandler(ScheduleVisit, [VISITS, ID_GENERATOR])
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
@CommandHandler(ScheduleVisit, [CLOCK, VISITS])
export class HandlerWithTokensOutOfOrder {
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
@CommandHandler(ScheduleVisit, [VISITS, CLOCK])
export class HandlerWithOneTokenTooMany {
  constructor(readonly visits: VisitRepository) {}

  async execute(_command: ScheduleVisit): Promise<string> {
    return 'visit-1';
  }
}

// @ts-expect-error -- one token missing: the constructor takes two parameters
@QueryHandler(CountVisits, [VISITS])
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

// @ts-expect-error -- the class does not implement the port its token stands for
@Repository(VISITS)
export class NotARepository {
  async save(_visit: Visit): Promise<void> {}
}

// @ts-expect-error -- an abstract class cannot be bound
@Adapter(VISITS)
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

// @ts-expect-error -- a token of the wrong type: CLOCK does not resolve to a CommandBus
@Scheduled('clinic.with-a-wrong-token', { cron: '0 7 * * *' }, [CLOCK])
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
