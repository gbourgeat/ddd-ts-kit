import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';

/** The table as the erasure reaches it: its statements are written on the table{{#if tenant.scoped}}, confined to the tenant of the work{{/if}}. */
const TABLE = { schema: {{context.constant}}_SCHEMA, table: '{{aggregate.table}}' };

/**
 * What `{{aggregate.table}}` keeps of a person in clear, and whose it is: the columns below belong to the person
 * `{{personal.subject}}` names{{#if personal.pseudonymise}}, and each reads `[erased]` once that person is erased{{/if}}{{#if personal.row}}, and their row is deleted once that person is erased{{/if}}.
 * Read by {{personal.names.adapter}}, which `npm run privacy:erase` runs; a column added later that holds
 * personal data is declared here too, and its mapper writes it.
 */
const declaration: PersonalFieldsOptions<{{aggregate.pascal}}Row> = {
  subject: '{{personal.subject}}',
{{personal.fields}}
  erasure: '{{personal.erasure}}',
{{#if personal.retains}}
  // TODO(domain): the mapper writes {{personal.retentionColumn}} empty: write the date the relation with the person ended (the contract closed, the account deleted), or these rows never expire. Never count from the registration.
  retention: {{personal.retention}},
{{/if}}
};

export const {{aggregate.pascal}}PersonalFields = personalFields(TABLE, declaration);
