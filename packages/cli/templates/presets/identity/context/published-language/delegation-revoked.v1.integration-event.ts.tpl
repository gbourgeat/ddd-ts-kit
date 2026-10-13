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
import { DelegationRevokedV1Payload } from '{{alias.context}}/published-language/delegation-revoked.v1.payload{{alias.ext}}';
{{/if}}

export const delegationRevokedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.delegation.revoked',
  version: 1,
  description: 'A delegation ended before its period: what it lent, the delegate holds no more.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      delegationId: z.string(),
      organisationId: z.string(),
      delegatorId: z.string(),
      delegateId: z.string(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(DelegationRevokedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type DelegationRevokedV1Payload = PayloadOf<typeof delegationRevokedV1>;
{{/if}}
export type DelegationRevokedV1 = IntegrationEvent<DelegationRevokedV1Payload>;
