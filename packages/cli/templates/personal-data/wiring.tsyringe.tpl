@@imports
{{#if tenant.scoped}}
import { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{storage.moduleImport}}
import { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';
import { {{personal.names.adapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.adapterKebab}}.repository{{alias.ext}}';
@@registrations
builder.bind({{personal.names.port}}).toClass({{personal.names.adapter}}, [{{storage.token}}{{#if tenant.scoped}}, ExecutionScope{{/if}}]).as('repository');
