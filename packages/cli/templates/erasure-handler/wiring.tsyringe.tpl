@@imports
import { dataSubjectErasedV1 } from '@ddd-ts-kit/kernel';
import { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';
import { DataSubjectErasedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/data-subject-erased.integration-handler{{alias.ext}}';
@@registrations
builder.on(dataSubjectErasedV1, { consumer: '{{context.kebab}}.data-subject-erased' }).handledBy(DataSubjectErasedIntegrationHandler, [{{personal.names.port}}]);
