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
import { DelegationGrantedV1Payload } from '{{alias.context}}/published-language/delegation-granted.v1.payload{{alias.ext}}';
{{/if}}

export const delegationGrantedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.delegation.granted',
  version: 1,
  description: 'A member lent rights to another member of the organisation, from an instant to another.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      delegationId: z.string(),
      organisationId: z.string(),
      delegatorId: z.string(),
      delegateId: z.string(),
      rights: z.array(z.string()),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(DelegationGrantedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type DelegationGrantedV1Payload = PayloadOf<typeof delegationGrantedV1>;
{{/if}}
export type DelegationGrantedV1 = IntegrationEvent<DelegationGrantedV1Payload>;
