import { z } from 'zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

export const {{event.camel}}V{{event.version}} = defineIntegrationEvent({
  type: '{{event.name}}',
  version: {{event.version}},
  // TODO(domain): describe in one sentence, for the teams of other contexts, what "{{event.words}}" means.
  description: '{{event.title}}.',
  payload: zodSchema(
    z.object({
      {{aggregate.camel}}Id: z.string(),
      // TODO(domain): add what downstream contexts need to know about "{{event.words}}", as primitives; this is a public contract: inside version {{event.version}} a field can be added, never renamed or removed.
    }),
  ),
});

export type {{event.pascal}}V{{event.version}}Payload = PayloadOf<typeof {{event.camel}}V{{event.version}}>;
export type {{event.pascal}}V{{event.version}} = IntegrationEvent<{{event.pascal}}V{{event.version}}Payload>;
