import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { PersonRegisteredV1Payload } from '@/contexts/identity/published-language/person-registered.v1.payload';

export const personRegisteredV1 = defineIntegrationEvent({
  type: 'identity.person.registered',
  version: 1,
  description:
    'A person signed in for the first time and is now known to the platform, with the name and the address to reach them.',
  personal: { subject: 'personId', fields: ['displayName', 'email'] },
  payload: classSchema(PersonRegisteredV1Payload),
});

export type PersonRegisteredV1 = IntegrationEvent<PersonRegisteredV1Payload>;
