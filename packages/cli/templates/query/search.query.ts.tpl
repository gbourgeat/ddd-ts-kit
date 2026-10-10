import { AuthorizedQuery, type Actor, type PageRequest } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{access.useCasePermissionsImport}}
{{/if}}
import type { {{name.pascal}}Result, {{name.pascal}}Sort } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result.js';

{{#if style.declared}}
@{{access.decoration}}
{{/if}}
export class {{name.pascal}}Query extends AuthorizedQuery<{{name.pascal}}Result> {
  // TODO(domain): add the criteria of "{{name.words}}" as readonly primitives after the page (a status, a period).
  constructor(
    actor: Actor,
    readonly page: PageRequest<{{name.pascal}}Sort>,
  ) {
    super(actor);
  }
}
