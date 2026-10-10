import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { err, ok, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import type { {{event.pascal}}V{{event.version}}Payload } from './{{event.kebab}}.v{{event.version}}.payload.js';

export const {{event.camel}}V{{event.version}} = defineIntegrationEvent({
  type: '{{event.name}}',
  version: {{event.version}},
  // TODO(domain): describe in one sentence, for the teams of other contexts, what "{{event.words}}" means.
  description: '{{event.title}}.',
  // TODO(domain): check every field of the payload in the function below and describe each one in the JSON Schema next to it; the catalog of events is generated from it.
  payload: customSchema<{{event.pascal}}V{{event.version}}Payload>(
    (input) =>
      typeof input === 'object' && input !== null && '{{aggregate.camel}}Id' in input && typeof input.{{aggregate.camel}}Id === 'string'
        ? ok({ {{aggregate.camel}}Id: input.{{aggregate.camel}}Id })
        : err([{ path: '{{aggregate.camel}}Id', code: 'invalid_type', message: 'A string is expected.' }]),
    { type: 'object', required: ['{{aggregate.camel}}Id'], properties: { {{aggregate.camel}}Id: { type: 'string' } } },
  ),
});

export type {{event.pascal}}V{{event.version}} = IntegrationEvent<{{event.pascal}}V{{event.version}}Payload>;
