{{#if personal.ofTable}}
import type { EntitySchema } from 'typeorm';
{{/if}}
import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
{{#unless personal.ofTable}}
import type { {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';
{{/unless}}
{{#if personal.ofTable}}

/** The row an entity schema types. */
type RowOf<Schema> = Schema extends EntitySchema<infer Row> ? Row : never;
{{/if}}

/**
 * What `{{aggregate.table}}` keeps of a person in clear, and whose it is: the columns below belong to the person
 * `{{personal.subject}}` names{{#if personal.pseudonymise}}, and each reads `[erased]` once that person is erased{{/if}}{{#if personal.row}}, and their row is deleted once that person is erased{{/if}}.
 * Read by {{personal.names.adapter}}, which `npm run privacy:erase` runs; a column added later that holds
 * personal data is declared here too{{#unless personal.ofTable}}, and its mapper writes it{{/unless}}.
 */
{{#if personal.ofTable}}
const declaration: PersonalFieldsOptions<RowOf<typeof {{aggregate.tableCamel}}>> = {
{{/if}}
{{#unless personal.ofTable}}
const declaration: PersonalFieldsOptions<{{aggregate.pascal}}Row> = {
{{/unless}}
  subject: '{{personal.subject}}',
{{personal.fields}}
  erasure: '{{personal.erasure}}',
{{#if personal.retains}}
{{#unless personal.ofTable}}
  // TODO(domain): the mapper writes {{personal.retentionColumn}} empty: write the date the relation with the person ended (the contract closed, the account deleted), or these rows never expire. Never count from the registration.
{{/unless}}
{{#if personal.ofTable}}
  // TODO(domain): what writes {{aggregate.table}} writes in {{personal.retentionColumn}} the date the relation with the person ended (the contract closed, the account deleted), or these rows never expire. Never count from the registration.
{{/if}}
  retention: {{personal.retention}},
{{/if}}
};

export const {{aggregate.pascal}}PersonalFields = personalFields({{aggregate.tableCamel}}, declaration);
