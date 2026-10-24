import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { PracticeMemberAddedV1Payload } from '@/contexts/identity/published-language/practice-member-added.v1.payload';

export const practiceMemberAddedV1 = defineIntegrationEvent({
  type: 'identity.practice.member-added',
  version: 1,
  description:
    'A person became a member of a practice with a role; the time zone of the practice travels with it so that a consumer needs nothing else to place the member.',
  personal: { subject: 'personId', fields: ['displayName'] },
  payload: classSchema(PracticeMemberAddedV1Payload),
});

export type PracticeMemberAddedV1 = IntegrationEvent<PracticeMemberAddedV1Payload>;
