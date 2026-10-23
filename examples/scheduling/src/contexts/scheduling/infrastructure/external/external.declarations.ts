import { injected } from '@ddd-ts-kit/kernel/declarations';
import { PersonDirectoryContract } from '@/contexts/identity/published-language';
import { InProcessPersonDirectoryGateway } from '@/contexts/scheduling/infrastructure/external/in-process-person-directory.gateway';

export * from '@/contexts/scheduling/infrastructure/external/in-process-person-directory.gateway';

injected(InProcessPersonDirectoryGateway, [PersonDirectoryContract]);
