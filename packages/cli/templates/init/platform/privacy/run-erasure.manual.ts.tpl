{{#if tenancy.any}}
import {
  dataSubjectErasedV1,
  eachTenant,
  eraseDataSubject,
  executionContext,
  inEachTenant,
  type Actor,
  type DataSubjectErasureReport,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenancy.any}}
import {
  dataSubjectErasedV1,
  eraseDataSubject,
  executionContext,
  type Actor,
  type DataSubjectErasureReport,
} from '@ddd-ts-kit/kernel';
{{/unless}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import { dataSubjectCopies } from '{{alias.platform}}/privacy/data-subject-copies{{alias.ext}}';

export interface ErasureRequest {
  /** The assembled platform: the {{#if eventSourcing.on}}keys, the {{/if}}scope and the copies come from it. */
  readonly platform: Platform;
  /** Who asks for the erasure, as typed: the actor of the work{{#if eventSourcing.on}}{{#if audit.on}}, named by the entry the audited keys write{{/if}}{{/if}}. */
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
 * key first{{#if audit.on}}, with its audit entry{{/if}}, then every copy a context declared in `data-subject-copies.ts`{{#if tenancy.any}}, in
 * every tenant{{/if}}. Running it again completes an erasure whose entry or copy failed; a subject that is
 * not an opaque identifier is refused before any key is touched.
 */
{{/if}}
{{#unless eventSourcing.on}}
/**
 * The right to erasure of one data subject, in an execution context of its own (origin `cli`):
 * every copy a context declared in `data-subject-copies.ts`{{#if tenancy.any}}, in every tenant{{/if}}. The aggregates
 * of this project are rows, so no key is destroyed: a copy is erased or pseudonymised where it
 * lies. Running it again completes an erasure whose copy failed; a subject that is not an opaque
 * identifier is refused before anything is touched.
 */
{{/unless}}
export function runErasure(subject: string, request: ErasureRequest): Promise<DataSubjectErasureReport> {
  const { platform, operator, correlationId } = request;
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });

  return platform.scope.run(context, async () => {
    const report = await eraseDataSubject(subject, {
{{#if eventSourcing.on}}
      // TODO(platform): once a projection is fed by the event store, give `rebuilds` the rebuild of each one: a projection keeps a clear copy of the person until it is rebuilt.
      keys: platform.eventSourcing.subjectKeys,
{{/if}}
      copies: dataSubjectCopies.map((copy) => copy(platform)),
{{#if tenancy.any}}
      inEveryTenant: inEachTenant(platform.scope, request.tenants),
{{/if}}
    });

    await announceErasure(subject, request);

    return report;
  });
}

/**
 * Once every copy is erased, `privacy.data-subject.erased` goes to the outbox{{#if tenancy.any}}, once per tenant{{/if}}: a context that
 * runs as a service of its own, or a system that copied the person from an integration event, erases
 * its copy on its side (GDPR article 19). The relay of the application delivers it; an erasure that
 * failed publishes nothing, and running it again does.
 */
async function announceErasure(subject: string, { platform, operator{{#if tenancy.any}}, tenants{{/if}} }: ErasureRequest): Promise<void> {
  const erasedAt = platform.clock.now();
  const payload = { subjectId: subject, erasedAt: erasedAt.toISOString(), requestedBy: operator };
  const event = () => dataSubjectErasedV1.create(payload, { id: platform.ids.next(), occurredAt: erasedAt });
  const publish = () => platform.publisher.publish([event()]);
{{#if tenancy.any}}

  await eachTenant(platform.scope, tenants, publish);
{{/if}}
{{#unless tenancy.any}}

  await publish();
{{/unless}}
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
