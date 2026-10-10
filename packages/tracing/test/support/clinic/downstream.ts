import {
  AggregateRoot,
  Command,
  CommandBus,
  Logger,
  Repository,
  err,
  ok,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import { defineContextModule, type ContextModule, type EventContract } from '@ddd-ts-kit/di';
import { traceLogFields } from '../../../src/index.js';

interface Booked {
  readonly appointmentId: string;
  readonly slot: string;
}

/** Shaped like a `defineIntegrationEvent` declaration of the published language of scheduling. */
export const AppointmentBookedEvent: EventContract<Booked> = {
  type: 'scheduling.appointment.booked',
  version: 1,
  parse(event) {
    const { payload } = event;
    const readable = typeof payload === 'object' && payload !== null && 'appointmentId' in payload && 'slot' in payload;

    if (!readable || typeof payload.appointmentId !== 'string' || typeof payload.slot !== 'string') {
      return err({ reason: 'invalid-payload' });
    }

    return ok({ ...event, payload: { appointmentId: payload.appointmentId, slot: payload.slot } });
  },
};

export class MailRefused extends Error {
  readonly code = 'MAIL_REFUSED';
}

export abstract class MailGateway {
  abstract send(appointmentId: string): Promise<void>;
}

/** The fake of the mail gateway: remembers what it sent, refuses as many sends as it is told to, and logs as an adapter does. */
export class RecordingMailGateway implements MailGateway {
  readonly sent: string[] = [];

  refusals = 0;

  constructor(private readonly logger: Logger) {}

  async send(appointmentId: string): Promise<void> {
    if (this.refusals > 0) {
      this.refusals -= 1;

      throw new MailRefused('smtp refused jane@example.org');
    }

    this.sent.push(appointmentId);
    this.logger.info('confirmation sent', traceLogFields());
  }
}

export class SendBookingConfirmation extends Command<undefined> {
  constructor(readonly appointmentId: string) {
    super();
  }
}

export class SendBookingConfirmationHandler {
  constructor(private readonly mail: MailGateway) {}

  async execute(command: SendBookingConfirmation): Promise<undefined> {
    await this.mail.send(command.appointmentId);

    return undefined;
  }
}

export class ConfirmOnAppointmentBooked {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<Booked>): Promise<void> => {
    await this.commands.execute(new SendBookingConfirmation(event.payload.appointmentId));
  };
}

export function notificationModule(): ContextModule {
  return defineContextModule({
    name: 'notification',
    register(builder) {
      builder.bind(MailGateway).toClass(RecordingMailGateway, [Logger]).as('external');
      builder.command(SendBookingConfirmation).handledBy(SendBookingConfirmationHandler, [MailGateway]);

      builder
        .on(AppointmentBookedEvent, { consumer: 'notification.appointment-booked' })
        .handledBy(ConfirmOnAppointmentBooked, [CommandBus]);
    },
  });
}

export class Booking extends AggregateRoot {
  constructor(id: string) {
    super(id);
  }
}

export abstract class BookingRepository extends Repository<Booking> {}

export class InMemoryBookingRepository implements BookingRepository {
  readonly bookings = new Map<string, Booking>();

  async findById(id: string): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async save(booking: Booking): Promise<void> {
    this.bookings.set(booking.id, booking);
  }
}

export class RecordBooking extends Command<undefined> {
  constructor(readonly appointmentId: string) {
    super();
  }
}

export class RecordBookingHandler {
  constructor(private readonly bookings: BookingRepository) {}

  async execute(command: RecordBooking): Promise<undefined> {
    await this.bookings.save(new Booking(command.appointmentId));

    return undefined;
  }
}

export class RecordOnAppointmentBooked {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<Booked>): Promise<void> => {
    await this.commands.execute(new RecordBooking(event.payload.appointmentId));
  };
}

export const analyticsModule = defineContextModule({
  name: 'analytics',
  register(builder) {
    builder.bind(BookingRepository).toClass(InMemoryBookingRepository);
    builder.command(RecordBooking).handledBy(RecordBookingHandler, [BookingRepository]);

    builder
      .on(AppointmentBookedEvent, { consumer: 'analytics.appointment-booked' })
      .handledBy(RecordOnAppointmentBooked, [CommandBus]);
  },
});
