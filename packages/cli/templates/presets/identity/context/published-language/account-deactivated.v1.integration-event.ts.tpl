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
import { AccountDeactivatedV1Payload } from '{{alias.context}}/published-language/account-deactivated.v1.payload{{alias.ext}}';
{{/if}}

export const accountDeactivatedV1 = defineIntegrationEvent({
  type: '{{context.kebab}}.account.deactivated',
  version: 1,
  description: 'An account was deactivated: its person signs in no more, and every context stops acting for it.',
{{#if validation.zod}}
  payload: zodSchema(
    z.object({
      accountId: z.string(),
    }),
  ),
{{/if}}
{{#if validation.classValidator}}
  payload: classSchema(AccountDeactivatedV1Payload),
{{/if}}
});

{{#if validation.zod}}
export type AccountDeactivatedV1Payload = PayloadOf<typeof accountDeactivatedV1>;
{{/if}}
export type AccountDeactivatedV1 = IntegrationEvent<AccountDeactivatedV1Payload>;
