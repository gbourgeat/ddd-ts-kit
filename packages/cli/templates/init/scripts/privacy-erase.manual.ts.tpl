import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { parseArgs } from 'node:util';
{{#if http.any}}
import { offlineAuthenticator } from '{{alias.platform}}/auth/authentication/offline-authenticator{{alias.ext}}';
{{/if}}
import { composeApplication } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
{{#if persistence.needsUrl}}
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
{{/if}}
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
{{#if tenancy.any}}
import { tenantDirectory } from '{{alias.platform}}/composition/tenant-directory{{alias.ext}}';
{{/if}}
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { runErasure } from '{{alias.platform}}/privacy/run-erasure{{alias.ext}}';

// The right to erasure of one data subject (GDPR, article 17), from the command line:
//   npm run privacy:erase -- <subject-id> [--operator <who-asks>]
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
// The report says what was reached. Running it again completes an erasure that failed half way.
// What this script cannot reach: backups, logs, exports and the copies no context declared.
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { operator: { type: 'string', default: os.userInfo().username } },
});

const [subject] = positionals;

if (subject === undefined || positionals.length > 1) {
  console.error('Usage: npm run privacy:erase -- <subject-id> [--operator <who-asks>]');
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

const application = composeApplication(persistence, {
  events: inProcessEvents(),
{{#if http.any}}
  authenticator: offlineAuthenticator,
{{/if}}
});

{{#if tenancy.any}}
const tenants = await tenantDirectory(persistence, fixedTenants).tenants();

if (tenants.length === 0) {
  console.error('The tenant directory lists no tenant: a write of tenant data is never widened. Name them in TENANTS, comma separated, or open an organisation first.');
  await application.stop();
  await persistence.close();
  process.exit(2);
}
{{/if}}

try {
  const report = await runErasure(subject, {
    platform: application.platform,
    operator: values.operator,
    correlationId: randomUUID(),
{{#if tenancy.any}}
    tenants,
{{/if}}
  });

  console.log(JSON.stringify(report, null, 2));
} finally {
  await application.stop();
  await persistence.close();
}
