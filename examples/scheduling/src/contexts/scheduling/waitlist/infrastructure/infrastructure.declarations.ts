import { injected } from '@ddd-ts-kit/kernel/declarations';
import { KnexWaitlistRepository } from '@/contexts/scheduling/waitlist/infrastructure/persistence/knex-waitlist.repository';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/scheduling/waitlist/infrastructure/persistence/knex-waitlist.repository';

injected(KnexWaitlistRepository, [KnexContext, ExecutionScope, Clock]);
