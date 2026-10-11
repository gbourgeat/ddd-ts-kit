import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DelegationRevokedV1Payload } from '@/contexts/identity/published-language/delegation-revoked.v1.payload';

export const delegationRevokedV1 = defineIntegrationEvent({
  type: 'identity.delegation.revoked',
  version: 1,
  description: 'A delegation ended: withdrawn, expired at its end date, or because one of the two left the practice.',
  payload: classSchema(DelegationRevokedV1Payload),
});

export type DelegationRevokedV1 = IntegrationEvent<DelegationRevokedV1Payload>;
