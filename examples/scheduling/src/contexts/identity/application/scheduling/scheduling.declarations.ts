import { injected } from '@ddd-ts-kit/kernel/declarations';
import { ExpireDelegationsJob } from '@/contexts/identity/application/scheduling/expire-delegations.job';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/identity/application/scheduling/expire-delegations.job';

injected(ExpireDelegationsJob, [CommandBus]);
