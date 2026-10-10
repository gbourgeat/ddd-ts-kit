import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { {{event.pascal}}V{{event.version}}Payload } from './{{event.kebab}}.v{{event.version}}.payload.js';

export const {{event.camel}}V{{event.version}} = defineIntegrationEvent({
  type: '{{event.name}}',
  version: {{event.version}},
  // TODO(domain): describe in one sentence, for the teams of other contexts, what "{{event.words}}" means.
  description: '{{event.title}}.',
  payload: classSchema({{event.pascal}}V{{event.version}}Payload),
});

export type {{event.pascal}}V{{event.version}} = IntegrationEvent<{{event.pascal}}V{{event.version}}Payload>;
