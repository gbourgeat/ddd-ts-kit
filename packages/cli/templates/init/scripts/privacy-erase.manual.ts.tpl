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
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { runErasure } from '{{alias.platform}}/privacy/run-erasure{{alias.ext}}';

// The right to erasure of one data subject (GDPR, article 17), from the command line:
//   npm run privacy:erase -- <subject-id> [--operator <who-asks>]
// The key of the subject is destroyed first, so every personal value of its stored events reads as
// erased{{#if audit.on}}, and the erasure leaves a dated entry in the audit trail{{/if}}; then every copy a context declared in
// src/platform/privacy/data-subject-copies.ts is erased{{#if tenancy.any}}, in each tenant of TENANTS (comma separated){{/if}}.
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

const tenants = (process.env['TENANTS'] ?? '').split(',').map((tenant) => tenant.trim()).filter((tenant) => tenant !== '');

if (tenants.length === 0) {
  console.error('TENANTS names the tenants the copies are erased in, comma separated: a write of tenant data is never widened.');
  process.exit(2);
}
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
