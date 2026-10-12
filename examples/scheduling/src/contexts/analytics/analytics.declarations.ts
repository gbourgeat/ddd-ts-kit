import { injected } from '@ddd-ts-kit/kernel/declarations';
import { OccupancyReader } from '@/contexts/analytics/application/ports/occupancy-reader.port';
import { OutcomeRegister } from '@/contexts/analytics/application/ports/outcome-register.port';
import { OutcomesProjection } from '@/contexts/analytics/application/projections/outcomes.projection';
import { SearchOccupancyHandler } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.handler';
import { InProcessAppointmentExportGateway } from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';
import { KnexOccupancyReader } from '@/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository';
import { KnexOutcomeRegister } from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';
import { SearchOccupancyController } from '@/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.controller';
import { AppointmentExportContract } from '@/contexts/scheduling/published-language/index';
import { Access } from '@ddd-ts-kit/auth';
import { QueryBus } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/analytics/application/projections/outcomes.projection';
export * from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.handler';
export * from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query';
export * from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';
export * from '@/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository';
export * from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';
export * from '@/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.controller';

injected(OutcomesProjection, [OutcomeRegister]);
injected(SearchOccupancyHandler, [OccupancyReader, Access]);
injected(InProcessAppointmentExportGateway, [AppointmentExportContract]);
injected(KnexOccupancyReader, [KnexContext]);
injected(KnexOutcomeRegister, [KnexContext]);
injected(SearchOccupancyController, [QueryBus]);
