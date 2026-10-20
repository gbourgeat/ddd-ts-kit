import { injected } from '@ddd-ts-kit/kernel/declarations';
import { KnexOccupancyReader } from '@/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository';
import { KnexOutcomeRegister } from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';
import { ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository';
export * from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';

injected(KnexOccupancyReader, [KnexContext, ExecutionScope]);
injected(KnexOutcomeRegister, [KnexContext, ExecutionScope]);
