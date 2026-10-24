{{#if tenant.scoped}}
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { TypeOrmPersonalDataErasure, type TypeOrmContext } from '@ddd-ts-kit/typeorm';
{{#if style.declared}}
import { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';
{{/unless}}
// ddd-ts-kit:imports
import { {{aggregate.pascal}}PersonalFields } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.personal-fields{{alias.ext}}';
// /ddd-ts-kit:imports

/**
 * What {{context.kebab}} keeps of a person in clear, erased from every table declared below as its
 * declaration says: the rows of the person deleted, or their personal columns pseudonymised, the files
 * they name deleted first. Run by `npm run privacy:erase` with the copies of the other contexts, never
 * by a use case{{#if tenant.scoped}}; every statement is confined to the tenant of the work{{/if}}.
 */
{{#if style.declared}}
@Repository({{personal.names.port}})
{{/if}}
{{personal.header}}
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
