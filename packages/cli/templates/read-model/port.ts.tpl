import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

export type {{name.pascal}}Row = {
  readonly id: string;
{{#if fields.any}}
{{fields.row}}
{{/if}}
{{#unless fields.any}}
  // TODO(domain): add one field per thing a read of "{{name.words}}" shows or filters by, with its line in the criteria below, its column in the table and its entry in the columns of the store adapter (`--field <name>:<type>` writes the four).
{{/unless}}
};

export const {{name.camel}}Criteria = defineCriteria<{{name.pascal}}Row>({
  fields: {
    // TODO(domain): open to the readers only what a screen needs: `filter: ['eq']` on a field it filters by, `sortable: true` on a field it sorts by, then a `defaultSort`.
    id: { type: 'string' },
{{#if fields.any}}
{{fields.criteria}}
{{/if}}
  },
  tieBreaker: 'id',
});

export abstract class {{name.pascal}} extends ReadModelStore<{{name.pascal}}Row> {}
