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
import { MemberRoleChangedV1Payload } from '{{alias.context}}/published-language/member-role-changed.v1.payload{{alias.ext}}';
{{/if}}

export const memberRoleChangedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.member.role-changed',
  version: 1,
  description: 'The role of a member of an organisation changed.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      memberId: z.string(),
      organisationId: z.string(),
      accountId: z.string(),
      from: z.string(),
      to: z.string(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(MemberRoleChangedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type MemberRoleChangedV1Payload = PayloadOf<typeof memberRoleChangedV1>;
{{/if}}
export type MemberRoleChangedV1 = IntegrationEvent<MemberRoleChangedV1Payload>;
