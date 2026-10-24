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
import { runExport } from '{{alias.platform}}/privacy/run-export{{alias.ext}}';

// The right of access and to portability of one data subject (GDPR, articles 15 and 20), from the
// command line:
//   npm run privacy:export -- <subject-id> [--operator <who-asks>] > export.json
// One JSON document on the standard output (`format`, `subject`, `exportedAt`, `records`): every
// record each context declared in src/platform/privacy/data-subject-exports.ts keeps of the
// person{{#if tenancy.any}}, in each tenant of TENANTS (comma separated){{/if}}, as plain data. Hand it over to the person, then delete
// the file{{#if audit.on}}; the audit trail keeps the entry of each export, never the values. Every run is a
// handover and leaves its entry, a trial included: try it on a test subject, never on a real person{{/if}}.
{{#if eventSourcing.on}}
// What this script cannot reach: the stored events (read them through the aggregate), backups,
// logs and the copies no context declared.
{{/if}}
{{#unless eventSourcing.on}}
// What this script cannot reach: backups, logs and the copies no context declared.
{{/unless}}
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { operator: { type: 'string', default: os.userInfo().username } },
});

const [subject] = positionals;

if (subject === undefined || positionals.length > 1) {
  console.error('Usage: npm run privacy:export -- <subject-id> [--operator <who-asks>]');
  process.exit(2);
}
{{#if tenancy.any}}

const tenants = (process.env['TENANTS'] ?? '').split(',').map((tenant) => tenant.trim()).filter((tenant) => tenant !== '');

if (tenants.length === 0) {
  console.error('TENANTS names the tenants the records are gathered in, comma separated.');
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
  const document = await runExport(subject, {
    platform: application.platform,
    operator: values.operator,
    correlationId: randomUUID(),
{{#if tenancy.any}}
    tenants,
{{/if}}
  });

  console.log(JSON.stringify(document, null, 2));
} finally {
  await application.stop();
  await persistence.close();
}
