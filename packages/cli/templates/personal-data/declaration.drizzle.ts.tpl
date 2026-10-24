import { personalFields, type PersonalFieldsOptions } from '@ddd-ts-kit/kernel';
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';

type {{aggregate.pascal}}Row = typeof {{aggregate.tableCamel}}.$inferSelect;

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
};

export const {{aggregate.pascal}}PersonalFields = personalFields({{aggregate.tableCamel}}, declaration);
