import { injected } from '@ddd-ts-kit/kernel/declarations';
import { JoinWaitlistController } from '@/contexts/scheduling/waitlist/presentation/http/calendars/join-waitlist/join-waitlist.controller';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/waitlist/presentation/http/calendars/join-waitlist/join-waitlist.controller';

injected(JoinWaitlistController, [CommandBus]);
