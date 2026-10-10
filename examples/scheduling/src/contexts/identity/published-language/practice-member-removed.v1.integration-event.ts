import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { PracticeMemberRemovedV1Payload } from '@/contexts/identity/published-language/practice-member-removed.v1.payload.js';

export const practiceMemberRemovedV1 = defineIntegrationEvent({
  type: 'identity.practice.member-removed',
  version: 1,
  description: 'A membership ended: the person no longer holds this role in the practice.',
  payload: classSchema(PracticeMemberRemovedV1Payload),
});

export type PracticeMemberRemovedV1 = IntegrationEvent<PracticeMemberRemovedV1Payload>;
