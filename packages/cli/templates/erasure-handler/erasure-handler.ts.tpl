import { dataSubjectErasedV1, type DataSubjectErasedPayload, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';

/**
 * What {{context.kebab}} keeps of a person, erased when the platform announces the erasure of that person
 * (`privacy.data-subject.erased`, published by `npm run privacy:erase` once every copy it reaches is
 * erased): the way a context that runs as a service of its own, or that copied the person from an
 * integration event, erases its copy (GDPR article 19). Delivery is at least once and the erasure is
 * idempotent: a second delivery reaches nothing. In the tenant of the event{{#if tenant.scoped}}, to which every statement
 * of the erasure is confined{{/if}}.
 */
export class DataSubjectErasedIntegrationHandler {
  static readonly eventType = dataSubjectErasedV1.type;

  constructor(private readonly erasure: {{personal.names.port}}) {}

  async handle(event: IntegrationEvent<DataSubjectErasedPayload>): Promise<void> {
    await this.erasure.erase(event.payload.subjectId);
  }
}
