import { IsString } from 'class-validator';
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';

export class {{event.pascal}}V{{event.version}}Payload {
  @IsString()
  {{aggregate.camel}}Id = '';

  // TODO(domain): add what downstream contexts need to know about "{{event.words}}", as decorated primitive fields; this is a public contract: inside version {{event.version}} a field can be added, never renamed or removed.
}

export const {{event.camel}}V{{event.version}} = defineIntegrationEvent({
  type: '{{event.name}}',
  version: {{event.version}},
  // TODO(domain): describe in one sentence, for the teams of other contexts, what "{{event.words}}" means.
  description: '{{event.title}}.',
  payload: classSchema({{event.pascal}}V{{event.version}}Payload),
});

export type {{event.pascal}}V{{event.version}} = IntegrationEvent<{{event.pascal}}V{{event.version}}Payload>;
