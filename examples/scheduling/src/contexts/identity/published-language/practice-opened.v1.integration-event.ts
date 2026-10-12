import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { PracticeOpenedV1Payload } from '@/contexts/identity/published-language/practice-opened.v1.payload';

export const practiceOpenedV1 = defineIntegrationEvent({
  type: 'identity.practice.opened',
  version: 1,
  description: 'A practice was opened, in its time zone, with its first manager.',
  payload: classSchema(PracticeOpenedV1Payload),
});

export type PracticeOpenedV1 = IntegrationEvent<PracticeOpenedV1Payload>;
