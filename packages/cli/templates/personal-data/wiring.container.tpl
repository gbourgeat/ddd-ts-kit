@@imports
{{#if tenant.scoped}}
import { ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{storage.moduleImport}}
import { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';
import { {{personal.names.exportPort}} } from '{{alias.context}}/application/ports/{{personal.names.exportPortKebab}}.port{{alias.ext}}';
import { {{personal.names.adapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.adapterKebab}}.repository{{alias.ext}}';
import { {{personal.names.exportAdapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.exportAdapterKebab}}.repository{{alias.ext}}';
@@registrations
builder.bind({{personal.names.port}}).toClass({{personal.names.adapter}}, [{{storage.token}}{{#if tenant.scoped}}, ExecutionScope{{/if}}]).as('repository');
builder.bind({{personal.names.exportPort}}).toClass({{personal.names.exportAdapter}}, [{{storage.token}}{{#if tenant.scoped}}, ExecutionScope{{/if}}]).as('repository');
