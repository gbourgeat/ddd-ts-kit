import { injected } from '@ddd-ts-kit/kernel/declarations';
import { InProcessAppointmentExportGateway } from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';
import { KnexOccupancyReader } from '@/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository';
import { KnexOutcomeRegister } from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';
import { AppointmentExportContract } from '@/contexts/scheduling/published-language';
import { ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';
export * from '@/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository';
export * from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';

injected(InProcessAppointmentExportGateway, [AppointmentExportContract]);
injected(KnexOccupancyReader, [KnexContext, ExecutionScope]);
injected(KnexOutcomeRegister, [KnexContext, ExecutionScope]);
