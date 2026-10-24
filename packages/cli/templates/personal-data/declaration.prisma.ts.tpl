import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import type { PrismaPersonalTable } from '@ddd-ts-kit/prisma';

/** The table as the erasure reaches it, by the names `@@schema` and `@@map` give it: its statements are written on the table, not through the model. */
const TABLE: PrismaPersonalTable = { schema: '{{context.schema}}', table: '{{aggregate.table}}' };

/**
 * What `{{aggregate.table}}` keeps of a person in clear, and whose it is: the columns below belong to the person
 * `{{personal.subject}}` names{{#if personal.pseudonymise}}, and each reads `[erased]` once that person is erased{{/if}}{{#if personal.row}}, and their row is deleted once that person is erased{{/if}}.
 * Read by {{personal.names.adapter}}, which `npm run privacy:erase` runs; a column added later that holds
 * personal data is declared here too, and its mapper writes it.
 */
// The columns are named as the database spells them (`@map`), since the erasure writes SQL on the table.
const declaration: PersonalFieldsOptions<Record<string, unknown>> = {
  subject: '{{personal.subject}}',
{{personal.fields}}
  erasure: '{{personal.erasure}}',
{{#if personal.retains}}
  retention: {{personal.retention}},
{{/if}}
};

export const {{aggregate.pascal}}PersonalFields = personalFields(TABLE, declaration);
