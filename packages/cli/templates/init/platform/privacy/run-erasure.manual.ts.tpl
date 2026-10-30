{{#if audit.on}}
import { auditedPersonalDataErasure } from '@ddd-ts-kit/audit';
{{/if}}
{{#if events.outbox}}
import { personalEventsInOutbox } from '@ddd-ts-kit/events';
{{/if}}
import {
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
{{#if housekeeping.any}}
  type PersonalDataCopy,
{{/if}}
{{#unless housekeeping.any}}
{{#if audit.on}}
  type PersonalDataCopy,
{{/if}}
{{/unless}}
} from '@ddd-ts-kit/kernel';
{{#if queue.stored}}
import { jobsOfSubject } from '@ddd-ts-kit/scheduling';
{{/if}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import { dataSubjectCopies } from '{{alias.platform}}/privacy/data-subject-copies{{alias.ext}}';
{{#if events.outbox}}
import { personalEvents } from '{{alias.platform}}/privacy/personal-events{{alias.ext}}';
{{/if}}

export interface ErasureRequest {
  /** The assembled platform: the {{#if eventSourcing.on}}keys, the {{/if}}scope{{#if audit.on}}, the trail{{/if}} and the copies come from it. */
  readonly platform: Platform;
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
  const { platform, operator, correlationId } = request;
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });
{{#if audit.on}}
  const source = { scope: platform.scope, clock: platform.clock, ids: platform.ids };
  const audited = (copy: PersonalDataCopy): PersonalDataCopy =>
    auditedPersonalDataErasure(copy, platform.audit.trail, source);
{{/if}}

  return platform.scope.run(context, async () => {
    const report = await eraseDataSubject(subject, {
{{#if eventSourcing.on}}
      // TODO(platform): once a projection is fed by the event store, give `rebuilds` the rebuild of each one: a projection keeps a clear copy of the person until it is rebuilt.
      keys: platform.eventSourcing.subjectKeys,
{{/if}}
{{#if audit.on}}
      copies: dataSubjectCopies.map((copy) => audited(copy(platform))),
{{#if housekeeping.any}}
      shared: platformCopies(platform).map(audited),
{{/if}}
{{/if}}
{{#unless audit.on}}
      copies: dataSubjectCopies.map((copy) => copy(platform)),
{{#if housekeeping.any}}
      shared: platformCopies(platform),
{{/if}}
{{/unless}}
{{#if tenancy.any}}
      inEveryTenant: inEachTenant(platform.scope, request.tenants),
{{/if}}
    });

    await announceErasure(subject, request);

    return report;
  });
}

{{#if housekeeping.any}}
/** What the platform keeps of a person in tables no tenant confines{{#if events.outbox}}: the records of the outbox, by what `personal-events.ts` lists{{/if}}{{#if queue.stored}}{{#if events.outbox}},{{/if}}{{#unless events.outbox}}:{{/unless}} the jobs enqueued with the person as `subject`{{/if}}. */
function platformCopies(platform: Platform): readonly PersonalDataCopy[] {
{{#if events.outbox}}
  const outbox = personalEventsInOutbox(platform.persistence.outbox, personalEvents);
{{/if}}
{{#if queue.stored}}
  const jobs = jobsOfSubject(platform.jobStore);
{{/if}}

  return [{{#if events.outbox}}outbox{{/if}}{{#if events.outbox}}{{#if queue.stored}}, {{/if}}{{/if}}{{#if queue.stored}}jobs{{/if}}];
}

{{/if}}
/**
 * Once every copy is erased, `privacy.data-subject.erased` goes to the outbox{{#if tenancy.any}}, once per tenant{{/if}}: a context that
 * runs as a service of its own, or a system that copied the person from an integration event, erases
 * its copy on its side (GDPR article 19). It names the person by id and nobody else{{#if audit.on}}: who asked is in
 * the audit trail, under the correlation id the event carries{{/if}}. The relay of the application delivers it; an erasure that
 * failed publishes nothing, and running it again does.
 */
async function announceErasure(subject: string, { platform{{#if tenancy.any}}, tenants{{/if}} }: ErasureRequest): Promise<void> {
  const erasedAt = platform.clock.now();
  const payload = { subjectId: subject, erasedAt: erasedAt.toISOString() };
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
