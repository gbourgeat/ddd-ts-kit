import {
  AuthorizedCommand,
  Command,
  Query,
  err,
  ok,
  type Actor,
  type Clock,
  type CommandBus,
  type DomainEvent,
  type IntegrationEvent,
} from '../../../src/index.js';
import {
  Adapter,
  CLOCK,
  COMMAND_BUS,
  CommandHandler,
  DomainEventHandler,
  IntegrationEventHandler,
  Gateway,
  Policy,
  Public,
  QueryHandler,
  Repository,
  Requires,
  Scheduled,
  token,
  type EventContract,
  type JobExecution,
  type ScheduledJob,
} from '../../../src/declarations.js';

export interface Visit {
  readonly id: string;
  readonly patientId: string;
  readonly startsAt: Date;
}

export interface VisitRepository {
  save(visit: Visit): Promise<void>;
  findById(id: string): Promise<Visit | undefined>;
}

export interface Reminders {
  remind(patientId: string): Promise<void>;
}

export interface Rooms {
  isFree(at: Date): Promise<boolean>;
}

export const VISITS = token<VisitRepository>('clinic.VisitRepository');
export const REMINDERS = token<Reminders>('clinic.Reminders');
export const ROOMS = token<Rooms>('clinic.Rooms');

export const scheduleVisits = { id: 'clinic:visit.schedule' };

@Requires(scheduleVisits, {
  resource: (command: ScheduleVisit) => ({ type: 'patient', id: command.patientId }),
  context: (command: ScheduleVisit) => ({ onBehalfOf: command.actor.id }),
  audited: ['startsAt', { field: 'patientId', masked: true }],
})
export class ScheduleVisit extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly patientId: string,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}

@Public()
export class ListOpeningHours extends Query<readonly string[]> {}

@Public({ audited: ['reason'] })
export class RequestCallback extends Command {
  constructor(readonly reason: string) {
    super();
  }
}

@CommandHandler(ScheduleVisit, [VISITS, CLOCK])
export class ScheduleVisitHandler implements CommandHandler<ScheduleVisit> {
  constructor(
    private readonly visits: VisitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ScheduleVisit): Promise<string> {
    const id = `visit-${this.clock.now().getTime()}`;
    await this.visits.save({ id, patientId: command.patientId, startsAt: command.startsAt });
    return id;
  }
}

@QueryHandler(ListOpeningHours)
export class ListOpeningHoursHandler implements QueryHandler<ListOpeningHours> {
  async execute(): Promise<readonly string[]> {
    return ['09:00-18:00'];
  }
}

export interface PatientRegisteredPayload {
  readonly patientId: string;
}

export const PatientRegistered: EventContract<PatientRegisteredPayload> = {
  type: 'registry.patient.registered',
  version: 1,
  parse(event) {
    const { payload } = event;
    if (typeof payload !== 'object' || payload === null || !('patientId' in payload)) {
      return err({ reason: 'invalid-payload' });
    }
    return typeof payload.patientId === 'string' ? ok({ ...event, payload: { patientId: payload.patientId } }) : err({ reason: 'invalid-payload' });
  },
};

@IntegrationEventHandler(PatientRegistered, { consumer: 'clinic.welcome-on-patient-registered' }, [COMMAND_BUS])
export class WelcomeOnPatientRegistered implements IntegrationEventHandler<PatientRegisteredPayload> {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<PatientRegisteredPayload>): Promise<void> => {
    await this.commands.execute(new RequestCallback(`welcome ${event.payload.patientId}`));
  };
}

export class VisitScheduled implements DomainEvent {
  readonly name = 'clinic.visit.scheduled';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

@DomainEventHandler(VisitScheduled, { name: 'clinic.visit.scheduled' }, [REMINDERS])
export class RemindOnVisitScheduled implements DomainEventHandler<VisitScheduled> {
  constructor(private readonly reminders: Reminders) {}

  async handle(event: VisitScheduled): Promise<void> {
    await this.reminders.remind(event.aggregateId);
  }
}

@Scheduled('clinic.remind-tomorrow-visits', { cron: '0 18 * * mon-fri', timeZone: 'Europe/Paris', overlap: 'queue', timeoutMs: 120_000 }, [COMMAND_BUS])
export class RemindTomorrowVisits implements ScheduledJob {
  static built = 0;

  constructor(private readonly commands: CommandBus) {
    RemindTomorrowVisits.built += 1;
  }

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new RequestCallback(`visits after ${execution.scheduledAt.toISOString()}`));
  }
}

@Scheduled('clinic.purge-expired-callbacks', { every: '6h' })
export class PurgeExpiredCallbacks {
  async run(): Promise<void> {}
}

@Repository(VISITS)
export class InMemoryVisitRepository implements VisitRepository {
  readonly visits = new Map<string, Visit>();

  async save(visit: Visit): Promise<void> {
    this.visits.set(visit.id, visit);
  }

  async findById(id: string): Promise<Visit | undefined> {
    return this.visits.get(id);
  }
}

const untouched = <T extends object>(instance: T): T => instance;

@Adapter(REMINDERS, { kind: 'external', transient: true, aspects: [untouched] }, [CLOCK])
export class SmsReminders implements Reminders {
  static built = 0;
  readonly sent: string[] = [];

  constructor(private readonly clock: Clock) {
    SmsReminders.built += 1;
  }

  async remind(patientId: string): Promise<void> {
    this.sent.push(`${patientId}@${this.clock.now().toISOString()}`);
  }
}

@Gateway(ROOMS, { replaces: true })
export class AlwaysFreeRooms implements Rooms {
  async isFree(): Promise<boolean> {
    return true;
  }
}

@Policy(scheduleVisits, { name: 'clinic.only-own-patients' })
export class OnlyOwnPatients {
  allows(actor: Actor, visit: Visit): boolean {
    return visit.patientId === actor.id;
  }
}

export class Undeclared {}

export function declareTwice(): void {
  @Public()
  @Public()
  class Twice extends Command {}
  void Twice;
}

export function declareAJob(name: `${string}.${string}`, cron: string, timeZone: string): void {
  Scheduled(name, { cron, timeZone });
}

export function declareAStranger(): void {
  const decorate = Public();
  class Stranger {}
  Reflect.apply(decorate, undefined, [Stranger, undefined]);
}
