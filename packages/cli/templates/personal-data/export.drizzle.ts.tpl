import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { DrizzlePersonalDataExport } from '@ddd-ts-kit/drizzle/postgres';
{{#if tenant.scoped}}
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{personal.names.exportPort}} } from '{{alias.context}}/application/ports/{{personal.names.exportPortKebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{personal.names.exportPort}} } from '{{alias.context}}/application/ports/{{personal.names.exportPortKebab}}.port{{alias.ext}}';
{{/unless}}
{{storage.adapterImport}}
// ddd-ts-kit:imports
import { {{aggregate.pascal}}PersonalFields } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.personal-fields{{alias.ext}}';
// /ddd-ts-kit:imports

/**
 * What {{context.kebab}} keeps of a person in clear, handed over from every table declared below as
 * plain data: one record per row about the person, under `{{context.kebab}}.<table>`, the personal columns
 * alone. Run by `npm run privacy:export` with the exports of the other contexts, never by a use
 * case{{#if tenant.scoped}}; every statement is confined to the tenant of the work{{/if}}.
 */
{{#if style.declared}}
@Repository({{personal.names.exportPort}})
{{/if}}
{{personal.exportHeader}}
  constructor(database: {{storage.token}}{{#if tenant.scoped}}, scope: ExecutionScope{{/if}}) {
    super(database, {
      name: '{{context.kebab}}',
      declarations: [
        // ddd-ts-kit:personal-fields
        {{aggregate.pascal}}PersonalFields,
        // /ddd-ts-kit:personal-fields
      ],
{{#if tenant.scoped}}
      tenant: { scope },
{{/if}}
    });
  }
}
