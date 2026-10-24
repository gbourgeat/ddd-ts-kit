{{#if audit.on}}
import { AuditTrail, auditedPersonalDataRetention } from '@ddd-ts-kit/audit';
{{/if}}
import type { Resolve } from '@ddd-ts-kit/di';
import {
  Clock,
{{#if audit.on}}
  ExecutionScope,
  IdGenerator,
{{/if}}
  isPersonalDataRetention,
  purgeExpiredPersonalData,
  type PersonalDataPurgeReport,
{{#if audit.on}}
  type PersonalDataRetention,
{{/if}}
} from '@ddd-ts-kit/kernel';
import { dataSubjectCopies } from '{{alias.platform}}/privacy/data-subject-copies{{alias.ext}}';

/**
 * The storage limitation of the application (GDPR article 5(1)(e)): every copy listed in
 * `data-subject-copies.ts` purges the rows that outlived the retention their declaration gives,
 * deleted or pseudonymised as it says{{#if tenancy.any}}, in every tenant: the work of the job names none, and a
 * tenant left out of a list would keep what it should not{{/if}}{{#if audit.on}}; each purge writes its entry to the audit
 * trail, the number of rows and no person{{/if}}. Run every night by the job `privacy.purge-expired` and by
 * `npm run privacy:purge`, each in an execution context of its own. A copy that fails does not stop
 * the others; the next run completes it.
 */
export function runPurge(resolve: Resolve): Promise<PersonalDataPurgeReport> {
  const clock = resolve(Clock);
  const retentions = dataSubjectCopies.map((copy) => resolve(copy)).filter(isPersonalDataRetention);
{{#if audit.on}}
  const trail = resolve(AuditTrail);
  const source = { scope: resolve(ExecutionScope), clock, ids: resolve(IdGenerator) };

  const audited = (port: PersonalDataRetention): PersonalDataRetention =>
    auditedPersonalDataRetention(port, trail, source);

  return purgeExpiredPersonalData(clock.now(), retentions.map(audited));
{{/if}}
{{#unless audit.on}}

  return purgeExpiredPersonalData(clock.now(), retentions);
{{/unless}}
}
