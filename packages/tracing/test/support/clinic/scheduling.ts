import {
  AggregateRoot,
  Clock,
  Command,
  CommandBus,
  DomainError,
  DomainEventDispatcher,
  IdGenerator,
  IntegrationEventPublisher,
  Query,
  Repository,
  type DomainEvent,
  type JobExecution,
} from '@ddd-ts-kit/kernel';
import { defineContextModule } from '@ddd-ts-kit/di';

export class AppointmentBooked implements DomainEvent {
  readonly name = 'scheduling.appointment.booked';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly slot: string,
  ) {}
}

export class SlotTaken extends DomainError {
  readonly code = 'SLOT_TAKEN';
}

export class Appointment extends AggregateRoot {
  private constructor(
    id: string,
    readonly slot: string,
  ) {
    super(id);
  }

  static book(id: string, slot: string, at: Date): Appointment {
    const appointment = new Appointment(id, slot);

    appointment.record(new AppointmentBooked(id, at, slot));

    return appointment;
  }
}

export abstract class AppointmentRepository extends Repository<Appointment> {
  abstract findOverlapping(slot: string): Promise<Appointment | undefined>;
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  /** Set by a spec: the database stops answering. */
  unreachable = false;

  private readonly appointments = new Map<string, Appointment>();

  async findById(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async findOverlapping(slot: string): Promise<Appointment | undefined> {
    if (this.unreachable) {
      throw new TypeError('connection to db.internal:5432 refused for user admin');
    }

    return [...this.appointments.values()].find((appointment) => appointment.slot === slot);
  }

  async save(appointment: Appointment): Promise<void> {
    if (appointment.slot === 'unreachable') {
      throw new TypeError('connection to db.internal:5432 refused for user admin');
    }

    this.appointments.set(appointment.id, appointment);
  }
}

export class BookAppointment extends Command<string> {
  constructor(readonly slot: string) {
    super();
  }
}

/** The whole use case: no event is pulled, no dispatcher is known. */
export class BookAppointmentHandler {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: BookAppointment): Promise<string> {
    if ((await this.appointments.findOverlapping(command.slot)) !== undefined) {
      throw new SlotTaken(`slot ${command.slot} is taken`);
    }

    const appointment = Appointment.book(this.ids.next(), command.slot, this.clock.now());

    await this.appointments.save(appointment);

    return appointment.id;
  }
}

export class GetAppointment extends Query<string | undefined> {
  constructor(readonly id: string) {
    super();
  }
}

export class GetAppointmentHandler {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(query: GetAppointment): Promise<string | undefined> {
    return (await this.appointments.findById(query.id))?.slot;
  }
}

/** Turns the domain event into the integration event of the published language. */
export class AppointmentBookedPublisher {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentBooked): Promise<void> {
    await this.publisher.publish([
      {
        id: this.ids.next(),
        type: event.name,
        version: 1,
        occurredAt: event.occurredAt.toISOString(),
        payload: { appointmentId: event.aggregateId, slot: event.slot },
      },
    ]);
  }
}

export class SendReminders extends Command<undefined> {}

export class SendRemindersHandler {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(): Promise<undefined> {
    await this.appointments.findOverlapping('tomorrow');

    return undefined;
  }
}

export class SendRemindersJob {
  constructor(private readonly commands: CommandBus) {}

  async run(_execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendReminders());
  }
}

export const schedulingModule = defineContextModule({
  name: 'scheduling',
  register(builder) {
    builder.bind(AppointmentRepository).toClass(InMemoryAppointmentRepository);
    builder.command(BookAppointment).handledBy(BookAppointmentHandler, [AppointmentRepository, IdGenerator, Clock]);
    builder.query(GetAppointment).handledBy(GetAppointmentHandler, [AppointmentRepository]);
    builder.command(SendReminders).handledBy(SendRemindersHandler, [AppointmentRepository]);
    builder.job('scheduling.send-reminders', { every: '1h' }).handledBy(SendRemindersJob, [CommandBus]);

    builder
      .bind(AppointmentBookedPublisher)
      .toClass(AppointmentBookedPublisher, [IntegrationEventPublisher, IdGenerator])
      .as('domain-event-handler');
  },
  onStart({ resolve }) {
    resolve(DomainEventDispatcher).on('scheduling.appointment.booked', async (event) => {
      if (event instanceof AppointmentBooked) {
        await resolve(AppointmentBookedPublisher).handle(event);
      }
    });
  },
});
