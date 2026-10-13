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
import { MemberRemovedV1Payload } from '{{alias.context}}/published-language/member-removed.v1.payload{{alias.ext}}';
{{/if}}

export const memberRemovedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.member.removed',
  version: 1,
  description: 'A member left an organisation: what they reached there through it, they reach no more.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      memberId: z.string(),
      organisationId: z.string(),
      accountId: z.string(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(MemberRemovedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type MemberRemovedV1Payload = PayloadOf<typeof memberRemovedV1>;
{{/if}}
export type MemberRemovedV1 = IntegrationEvent<MemberRemovedV1Payload>;
