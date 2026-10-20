import { injected } from '@ddd-ts-kit/kernel/declarations';
import { SchedulingAppointmentBookedIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-booked.integration-handler';
import { SchedulingAppointmentCancelledIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-cancelled.integration-handler';
import { SchedulingAppointmentConfirmedIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-confirmed.integration-handler';
import { SchedulingAppointmentExpiredIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-expired.integration-handler';
import { SchedulingAppointmentRescheduledIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-rescheduled.integration-handler';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/notification/application/integration/handlers/scheduling-appointment-booked.integration-handler';
export * from '@/contexts/notification/application/integration/handlers/scheduling-appointment-cancelled.integration-handler';
export * from '@/contexts/notification/application/integration/handlers/scheduling-appointment-confirmed.integration-handler';
export * from '@/contexts/notification/application/integration/handlers/scheduling-appointment-expired.integration-handler';
export * from '@/contexts/notification/application/integration/handlers/scheduling-appointment-rescheduled.integration-handler';

injected(SchedulingAppointmentBookedIntegrationHandler, [CommandBus]);
injected(SchedulingAppointmentCancelledIntegrationHandler, [CommandBus]);
injected(SchedulingAppointmentConfirmedIntegrationHandler, [CommandBus]);
injected(SchedulingAppointmentExpiredIntegrationHandler, [CommandBus]);
injected(SchedulingAppointmentRescheduledIntegrationHandler, [CommandBus]);
