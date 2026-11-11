@@imports
{{#if adapter.needsDatabase}}
{{#if tenant.scoped}}
import { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{storage.moduleImport}}
{{/if}}
import { {{name.pascal}} } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
import { {{adapter.pascal}} } from '{{alias.context}}/infrastructure/persistence/{{adapter.kebab}}{{alias.ext}}';
@@registrations
{{#if adapter.needsDatabase}}
{{#if tenant.scoped}}
builder.bind({{name.pascal}}).toClass({{adapter.pascal}}, [{{storage.token}}, ExecutionScope]).as('repository');
{{/if}}
{{#unless tenant.scoped}}
builder.bind({{name.pascal}}).toClass({{adapter.pascal}}, [{{storage.token}}]).as('repository');
{{/unless}}
{{/if}}
{{#unless adapter.needsDatabase}}
builder.bind({{name.pascal}}).toClass({{adapter.pascal}}).as('repository');
{{/unless}}
