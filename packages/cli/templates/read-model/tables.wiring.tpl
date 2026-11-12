@@imports
{{#if tenant.scoped}}
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
import { {{adapter.pascal}} } from '{{alias.context}}/infrastructure/persistence/{{adapter.kebab}}{{alias.ext}}';
@@read-model-tables
{{#if tenant.scoped}}
({ database }) => new {{adapter.pascal}}(database, new AsyncLocalStorageExecutionScope()),
{{/if}}
{{#unless tenant.scoped}}
({ database }) => new {{adapter.pascal}}(database),
{{/unless}}
