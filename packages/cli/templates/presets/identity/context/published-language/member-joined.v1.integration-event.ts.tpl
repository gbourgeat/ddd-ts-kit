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
import { MemberJoinedV1Payload } from '{{alias.context}}/published-language/member-joined.v1.payload{{alias.ext}}';
{{/if}}

export const memberJoinedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.member.joined',
  version: 1,
  description: 'An account became a member of an organisation, in a role.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      memberId: z.string(),
      organisationId: z.string(),
      accountId: z.string(),
      role: z.string(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(MemberJoinedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type MemberJoinedV1Payload = PayloadOf<typeof memberJoinedV1>;
{{/if}}
export type MemberJoinedV1 = IntegrationEvent<MemberJoinedV1Payload>;
