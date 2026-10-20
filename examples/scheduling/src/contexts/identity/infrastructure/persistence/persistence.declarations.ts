import { injected } from '@ddd-ts-kit/kernel/declarations';
import { KnexDelegationRepository } from '@/contexts/identity/infrastructure/persistence/knex-delegation.repository';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { KnexPracticeRepository } from '@/contexts/identity/infrastructure/persistence/knex-practice.repository';
import { TupleIdentityRelationships } from '@/contexts/identity/infrastructure/persistence/tuple-identity-relationships.repository';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/identity/infrastructure/persistence/knex-delegation.repository';
export * from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
export * from '@/contexts/identity/infrastructure/persistence/knex-practice.repository';
export * from '@/contexts/identity/infrastructure/persistence/tuple-identity-relationships.repository';

injected(KnexDelegationRepository, [KnexContext, ExecutionScope, Clock]);
injected(KnexPersonRepository, [KnexContext, ExecutionScope, Clock]);
injected(KnexPracticeRepository, [KnexContext, ExecutionScope, Clock]);
injected(TupleIdentityRelationships, [RelationTupleStore]);
