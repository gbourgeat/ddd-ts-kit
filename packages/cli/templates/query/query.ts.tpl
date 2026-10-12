import { {{access.queryBase}} } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { {{access.decorator}} } from '@ddd-ts-kit/kernel/declarations';
{{access.useCasePermissionsImport}}
{{/if}}
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

{{#if style.declared}}
@{{access.decoration}}
{{/if}}
export class {{name.pascal}}Query extends {{access.queryBase}}<{{name.pascal}}Result> {
  // TODO(domain): declare the criteria of "{{name.words}}" as a constructor with readonly primitives (filters, page), for example `{{access.constructorSample}}`.
}
