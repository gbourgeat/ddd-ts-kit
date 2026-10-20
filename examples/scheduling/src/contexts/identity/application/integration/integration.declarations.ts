import { injected } from '@ddd-ts-kit/kernel/declarations';
import { DelegationGrantedPublisher } from '@/contexts/identity/application/integration/publishers/delegation-granted.publisher';
import { DelegationRevokedPublisher } from '@/contexts/identity/application/integration/publishers/delegation-revoked.publisher';
import { PersonRegisteredPublisher } from '@/contexts/identity/application/integration/publishers/person-registered.publisher';
import { PracticeMemberAddedPublisher } from '@/contexts/identity/application/integration/publishers/practice-member-added.publisher';
import { PracticeMemberRemovedPublisher } from '@/contexts/identity/application/integration/publishers/practice-member-removed.publisher';
import { PracticeOpenedPublisher } from '@/contexts/identity/application/integration/publishers/practice-opened.publisher';
import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

export * from '@/contexts/identity/application/integration/publishers/delegation-granted.publisher';
export * from '@/contexts/identity/application/integration/publishers/delegation-revoked.publisher';
export * from '@/contexts/identity/application/integration/publishers/person-registered.publisher';
export * from '@/contexts/identity/application/integration/publishers/practice-member-added.publisher';
export * from '@/contexts/identity/application/integration/publishers/practice-member-removed.publisher';
export * from '@/contexts/identity/application/integration/publishers/practice-opened.publisher';

injected(DelegationGrantedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(DelegationRevokedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(PersonRegisteredPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(PracticeMemberAddedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(PracticeMemberRemovedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(PracticeOpenedPublisher, [IntegrationEventPublisher, IdGenerator]);
