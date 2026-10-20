import { injected } from '@ddd-ts-kit/kernel/declarations';
import { RemoteMailer } from '@/contexts/notification/infrastructure/external/remote-mailer.adapter';
import { Logger } from '@ddd-ts-kit/kernel';

export * from '@/contexts/notification/infrastructure/external/remote-mailer.adapter';

injected(RemoteMailer, [Logger]);
