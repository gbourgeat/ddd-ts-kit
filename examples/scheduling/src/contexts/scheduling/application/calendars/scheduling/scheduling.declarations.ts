import { injected } from '@ddd-ts-kit/kernel/declarations';
import { ExpireUnconfirmedAppointmentsJob } from '@/contexts/scheduling/application/calendars/scheduling/expire-unconfirmed-appointments.job';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/application/calendars/scheduling/expire-unconfirmed-appointments.job';

injected(ExpireUnconfirmedAppointmentsJob, [CommandBus]);
