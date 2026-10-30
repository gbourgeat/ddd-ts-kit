{{#if audit.on}}
import { AuditTrail, auditedPersonalDataErasure } from '@ddd-ts-kit/audit';
{{/if}}
import type { Application as Container } from '@ddd-ts-kit/di';
import {
  Clock,
  ExecutionScope,
  IdGenerator,
  IntegrationEventPublisher,
{{#if eventSourcing.on}}
  SubjectKeyStore,
{{/if}}
  dataSubjectErasedV1,
{{#if tenancy.any}}
  eachTenant,
{{/if}}
  eraseDataSubject,
  executionContext,
{{#if tenancy.any}}
  inEachTenant,
{{/if}}
  type Actor,
  type DataSubjectErasureReport,
{{#if audit.on}}
  type PersonalDataCopy,
{{/if}}
} from '@ddd-ts-kit/kernel';
import { dataSubjectCopies } from '{{alias.platform}}/privacy/data-subject-copies{{alias.ext}}';

export interface ErasureRequest {
  /** The composed application: the {{#if eventSourcing.on}}keys and the {{/if}}copies are resolved from it. */
  readonly container: Container;
  /** Who asks for the erasure, as typed: the actor of the work{{#if audit.on}}, named by the entry each copy writes{{/if}}. */
  readonly operator: string;
  /** The correlation of the work: one per erasure. */
  readonly correlationId: string;
{{#if tenancy.any}}
  /** The tenants the deployment serves: the copies are erased in each one, in an execution context of that tenant, since a write of tenant data is never widened. */
  readonly tenants: readonly string[];
{{/if}}
}

{{#if eventSourcing.on}}
/**
 * The right to erasure of one data subject, in an execution context of its own (origin `cli`): the
 * key first, then every copy a context declared in `data-subject-copies.ts`{{#if tenancy.any}}, in every tenant{{/if}}{{#if audit.on}}; the key and every
 * copy write their entry to the audit trail, the operator, the subject and the number of rows, never
 * the values{{/if}}. Running it again completes an erasure whose entry or copy failed; a subject that is
 * not an opaque identifier is refused before any key is touched.
 */
{{/if}}
{{#unless eventSourcing.on}}
/**
 * The right to erasure of one data subject, in an execution context of its own (origin `cli`):
 * every copy a context declared in `data-subject-copies.ts`{{#if tenancy.any}}, in every tenant{{/if}}. The aggregates
 * of this project are rows, so no key is destroyed: a copy is erased or pseudonymised where it
 * lies{{#if audit.on}}, and writes its entry to the audit trail, the operator, the subject and the number of
 * rows, never the values{{/if}}. Running it again completes an erasure whose copy failed; a subject that is not an
 * opaque identifier is refused before anything is touched.
 */
{{/unless}}
export function runErasure(subject: string, request: ErasureRequest): Promise<DataSubjectErasureReport> {
  const { container, operator, correlationId } = request;
  const scope = container.resolve(ExecutionScope);
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });
{{#if audit.on}}
  const trail = container.resolve(AuditTrail);
  const source = { scope, clock: container.resolve(Clock), ids: container.resolve(IdGenerator) };
  const audited = (copy: PersonalDataCopy): PersonalDataCopy => auditedPersonalDataErasure(copy, trail, source);
{{/if}}

  return scope.run(context, async () => {
    const report = await eraseDataSubject(subject, {
{{#if eventSourcing.on}}
      // TODO(platform): once a projection is fed by the event store, give `rebuilds` the rebuild of each one: a projection keeps a clear copy of the person until it is rebuilt.
      keys: container.resolve(SubjectKeyStore),
{{/if}}
{{#if audit.on}}
      copies: dataSubjectCopies.map((copy) => audited(container.resolve(copy))),
{{/if}}
{{#unless audit.on}}
      copies: dataSubjectCopies.map((copy) => container.resolve(copy)),
{{/unless}}
{{#if tenancy.any}}
      inEveryTenant: inEachTenant(scope, request.tenants),
{{/if}}
    });

    await announceErasure(subject, request);

    return report;
  });
}

/**
 * Once every copy is erased, `privacy.data-subject.erased` goes to the outbox{{#if tenancy.any}}, once per tenant{{/if}}: a context that
 * runs as a service of its own, or a system that copied the person from an integration event, erases
 * its copy on its side (GDPR article 19). It names the person by id and nobody else{{#if audit.on}}: who asked is in
 * the audit trail, under the correlation id the event carries{{/if}}. The relay of the application delivers it; an erasure that
 * failed publishes nothing, and running it again does.
 */
async function announceErasure(subject: string, request: ErasureRequest): Promise<void> {
  const { container } = request;
  const publisher = container.resolve(IntegrationEventPublisher);
  const ids = container.resolve(IdGenerator);
  const erasedAt = container.resolve(Clock).now();
  const payload = { subjectId: subject, erasedAt: erasedAt.toISOString() };
  const event = () => dataSubjectErasedV1.create(payload, { id: ids.next(), occurredAt: erasedAt });
  const publish = () => publisher.publish([event()]);
{{#if tenancy.any}}

  await eachTenant(container.resolve(ExecutionScope), request.tenants, publish);
{{/if}}
{{#unless tenancy.any}}

  await publish();
{{/unless}}
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
