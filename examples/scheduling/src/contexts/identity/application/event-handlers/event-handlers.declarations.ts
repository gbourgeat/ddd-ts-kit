import { injected } from '@ddd-ts-kit/kernel/declarations';
import { DelegationGrantedEventHandler } from '@/contexts/identity/application/event-handlers/delegation-granted.event-handler';
import { DelegationRevokedEventHandler } from '@/contexts/identity/application/event-handlers/delegation-revoked.event-handler';
import { PersonRegisteredEventHandler } from '@/contexts/identity/application/event-handlers/person-registered.event-handler';
import { PracticeMemberAddedEventHandler } from '@/contexts/identity/application/event-handlers/practice-member-added.event-handler';
import { PracticeMemberRemovedEventHandler } from '@/contexts/identity/application/event-handlers/practice-member-removed.event-handler';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';

export * from '@/contexts/identity/application/event-handlers/delegation-granted.event-handler';
export * from '@/contexts/identity/application/event-handlers/delegation-revoked.event-handler';
export * from '@/contexts/identity/application/event-handlers/person-registered.event-handler';
export * from '@/contexts/identity/application/event-handlers/practice-member-added.event-handler';
export * from '@/contexts/identity/application/event-handlers/practice-member-removed.event-handler';

injected(DelegationGrantedEventHandler, [IdentityRelationships]);
injected(DelegationRevokedEventHandler, [IdentityRelationships]);
injected(PersonRegisteredEventHandler, [IdentityRelationships]);
injected(PracticeMemberAddedEventHandler, [IdentityRelationships]);
injected(PracticeMemberRemovedEventHandler, [IdentityRelationships, DelegationRepository]);
