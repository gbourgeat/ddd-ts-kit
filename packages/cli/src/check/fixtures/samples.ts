/** Small contents the fixtures share. */
export const SAMPLES = {
  GLOSSARY:
    '| Term | Meaning |\n|---|---|\n| Invoice | A request for payment. |\n| Issue | To make an invoice final. |\n| Money | An amount in a currency. |\n| Reminder | A message about an unpaid invoice. |\n| Send | To hand a message to its recipient. |',
  SPEC: "import { it } from 'vitest';\n\nit.todo('behaves');\n",
  RECORD: '# Decision\n\nContext, deviation, reason, scope, condition for removal.\n',
  DECLARE:
    "import { z } from 'zod';\nimport { defineIntegrationEvent } from '@ddd-ts-kit/events';\nimport { zodSchema } from '@ddd-ts-kit/validation/zod';\n",
  PAYLOAD: 'payload: zodSchema(z.object({ invoiceId: z.string() }))',
} as const;
