{{#if validation.zod}}
import { z } from 'zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
{{/if}}
{{#if validation.classValidator}}
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { OrganisationOpenedV1Payload } from '{{alias.context}}/published-language/organisation-opened.v1.payload{{alias.ext}}';
{{/if}}

export const organisationOpenedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.organisation.opened',
  version: 1,
  description: 'An organisation was opened; with tenants, it is a new tenant.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      organisationId: z.string(),
      name: z.string(),
      openedBy: z.string(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(OrganisationOpenedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type OrganisationOpenedV1Payload = PayloadOf<typeof organisationOpenedV1>;
{{/if}}
export type OrganisationOpenedV1 = IntegrationEvent<OrganisationOpenedV1Payload>;
