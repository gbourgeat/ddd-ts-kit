@@imports
{{#if consumer.transactional}}
import { consume, subscribeAll } from '@ddd-ts-kit/events';
{{/if}}
{{#unless consumer.transactional}}
import { on, subscribeAll } from '@ddd-ts-kit/events';
{{/unless}}
import { dataSubjectErasedV1 } from '@ddd-ts-kit/kernel';
import { {{personal.names.adapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.adapterKebab}}.repository{{alias.ext}}';
import { DataSubjectErasedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/data-subject-erased.integration-handler{{alias.ext}}';
@@registrations
const dataSubjectErasedIntegrationHandler = new DataSubjectErasedIntegrationHandler(platform.adapter(new {{personal.names.adapter}}(platform.persistence.database{{#if tenant.scoped}}, platform.scope{{/if}}), { kind: 'repository', context: '{{context.kebab}}', token: '{{personal.names.port}}' }));

{{#if consumer.transactional}}
subscribeAll({{consumer.subscriber}}, [
  consume(dataSubjectErasedV1, { consumer: '{{context.kebab}}.data-subject-erased', processed: platform.persistence.processedEvents, unitOfWork: platform.persistence.unitOfWork, scope: platform.scope }, (event) => dataSubjectErasedIntegrationHandler.handle(event)),
]);
{{/if}}
{{#unless consumer.transactional}}
subscribeAll({{consumer.subscriber}}, [
  on(dataSubjectErasedV1, (event) => dataSubjectErasedIntegrationHandler.handle(event), { consumer: '{{context.kebab}}.data-subject-erased', processed: platform.persistence.processedEvents, scope: platform.scope }),
]);
{{/unless}}
