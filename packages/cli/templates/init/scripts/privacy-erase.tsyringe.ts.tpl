import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { UnknownDataSubjectError } from '@ddd-ts-kit/kernel';
{{#if http.any}}
import { offlineAuthenticator } from '{{alias.platform}}/auth/authentication/offline-authenticator{{alias.ext}}';
{{/if}}
import { composeApplication } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
{{#if persistence.needsUrl}}
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
{{/if}}
{{#unless persistence.needsUrl}}
{{#if queue.redis}}
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
{{/if}}
{{/unless}}
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
{{#if tenancy.any}}
import { tenantDirectory } from '{{alias.platform}}/composition/tenant-directory{{alias.ext}}';
{{/if}}
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { runErasure } from '{{alias.platform}}/privacy/run-erasure{{alias.ext}}';
{{#if queue.redis}}
import { openRedis } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
{{/if}}

// The right to erasure of one data subject (GDPR, article 17), from the command line:
//   npm run privacy:erase -- <subject-id> [--operator <who-asks>] [--rerun]
{{#if eventSourcing.on}}
// The key of the subject is destroyed first, so every personal value of its stored events reads as
// erased; then every copy a context declared in src/platform/privacy/data-subject-copies.ts is
// erased{{#if tenancy.any}}, in each tenant the tenant directory lists (TENANTS, or the organisations of the identity context){{/if}}{{#if audit.on}}. The key and each copy leave a dated
// entry in the audit trail, with the operator{{/if}}.
{{/if}}
{{#unless eventSourcing.on}}
// Every copy a context declared in src/platform/privacy/data-subject-copies.ts is erased or
// pseudonymised where it lies{{#if tenancy.any}}, in each tenant the tenant directory lists (TENANTS, or the organisations of the identity context){{/if}}: the aggregates of
// this project are rows, so there is no key to destroy{{#if audit.on}}. Each copy leaves a dated entry in the audit
// trail, with the operator{{/if}}.
{{/unless}}
{{#if housekeeping.any}}
// {{#if events.outbox}}What the outbox keeps of the person, by the fields src/platform/privacy/personal-events.ts lists{{#if queue.stored}}, and{{/if}}{{/if}}{{#unless events.outbox}}{{#if queue.stored}}And{{/if}}{{/unless}}{{#if queue.stored}} the jobs
// enqueued with the person as `subject`{{/if}} are erased too.
{{/if}}
// The report says what was reached. An id that reached nothing is refused, exit code 1, and announced
// to nobody: a mistyped id{{#if tenancy.any}}, a tenant missing from the directory{{/if}} or an erasure already complete. --rerun says
// it is expected, and announces the erasure again: running it completes one that failed half way.
// What this script cannot reach: backups, logs, exports and the copies no context declared.
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    operator: { type: 'string', default: os.userInfo().username },
    rerun: { type: 'boolean', default: false },
  },
});

const [subject] = positionals;

if (subject === undefined || positionals.length > 1) {
  console.error('Usage: npm run privacy:erase -- <subject-id> [--operator <who-asks>] [--rerun]');
  process.exit(2);
}
{{#if tenancy.any}}

// The tenants of a project with no source of tenants (comma separated); the identity preset reads its organisations instead.
const fixedTenants = (process.env['TENANTS'] ?? '').split(',').map((tenant) => tenant.trim()).filter((tenant) => tenant !== '');
{{/if}}

{{#if persistence.needsUrl}}
const persistence = {{persistence.await}}openPersistence(loadConfig(process.env));
{{/if}}
{{#unless persistence.needsUrl}}
const persistence = openPersistence();
{{/unless}}

{{#if queue.redis}}
const redis = openRedis(loadConfig(process.env));

{{/if}}
const application = composeApplication(persistence, {
  events: inProcessEvents(),
{{#if audit.on}}
  // Errors alone are logged: a failure whose audit entry could not be written says so, and what the script prints stays clean.
  log: { level: 'error', format: 'json', service: 'privacy-erase', environment: process.env['NODE_ENV'] ?? 'development', scrubMessages: true },
{{/if}}
{{#if http.any}}
  authenticator: offlineAuthenticator,
{{/if}}
{{#if queue.redis}}
  redis,
{{/if}}
});

{{#if tenancy.any}}
const tenants = await tenantDirectory(persistence, fixedTenants).tenants();

if (tenants.length === 0) {
  console.error('The tenant directory lists no tenant: a write of tenant data is never widened. Name them in TENANTS, comma separated, or open an organisation first.');
  await application.stop();
{{#if queue.redis}}
  await redis.close();
{{/if}}
  await persistence.close();
  process.exit(2);
}
{{/if}}

try {
  const report = await runErasure(subject, {
    container: application.container,
    operator: values.operator,
    correlationId: randomUUID(),
    rerun: values.rerun,
{{#if tenancy.any}}
    tenants,
{{/if}}
  });

  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (!(error instanceof UnknownDataSubjectError)) {
    throw error;
  }

  console.error(`${error.message}.{{#if tenancy.any}} Or a tenant the directory does not list.{{/if}} Nothing was announced; --rerun says this person was erased before.`);
  process.exitCode = 1;
} finally {
  await application.stop();
{{#if queue.redis}}
  await redis.close();
{{/if}}
  await persistence.close();
}
