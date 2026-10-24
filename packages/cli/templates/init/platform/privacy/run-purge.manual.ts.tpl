{{#if audit.on}}
import { auditedPersonalDataRetention } from '@ddd-ts-kit/audit';
import {
  isPersonalDataRetention,
  purgeExpiredPersonalData,
  type PersonalDataPurgeReport,
  type PersonalDataRetention,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless audit.on}}
import { isPersonalDataRetention, purgeExpiredPersonalData, type PersonalDataPurgeReport } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
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
export function runPurge(platform: Platform): Promise<PersonalDataPurgeReport> {
  const retentions = dataSubjectCopies.map((copy) => copy(platform)).filter(isPersonalDataRetention);
{{#if audit.on}}
  const source = { scope: platform.scope, clock: platform.clock, ids: platform.ids };

  const audited = (port: PersonalDataRetention): PersonalDataRetention =>
    auditedPersonalDataRetention(port, platform.audit.trail, source);

  return purgeExpiredPersonalData(platform.clock.now(), retentions.map(audited));
{{/if}}
{{#unless audit.on}}

  return purgeExpiredPersonalData(platform.clock.now(), retentions);
{{/unless}}
}
