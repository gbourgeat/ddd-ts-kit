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
{{#unless persistence.needsUrl}}
{{#if search.opensearch}}
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
{{/if}}
{{/unless}}
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
{{#if tenancy.any}}
import { tenantDirectory } from '{{alias.platform}}/composition/tenant-directory{{alias.ext}}';
{{/if}}
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { runExport } from '{{alias.platform}}/privacy/run-export{{alias.ext}}';

// The right of access and to portability of one data subject (GDPR, articles 15 and 20), from the
// command line:
//   npm run privacy:export -- <subject-id> [--operator <who-asks>] > export.json
// One JSON document on the standard output (`format`, `subject`, `exportedAt`, `records`): every
// record each context declared in src/platform/privacy/data-subject-exports.ts keeps of the
// person{{#if eventSourcing.on}}, and every value the event store keeps sealed with the key of the person (`platform.event-store.<event type>`){{/if}}{{#if tenancy.any}}, in each tenant the tenant directory lists (TENANTS, or the organisations of the identity context){{/if}}, as plain data. Hand it over to the person, then delete
// the file{{#if audit.on}}; the audit trail keeps the entry of each export, never the values. Every run is a
// handover and leaves its entry, a trial included: try it on a test subject, never on a real person{{/if}}.
// What this script cannot reach: backups, logs and the copies no context declared.
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
{{#if audit.on}}
  // Errors alone are logged: a failure whose audit entry could not be written says so, and what the script prints stays clean.
  log: { level: 'error', format: 'json', service: 'privacy-export', environment: process.env['NODE_ENV'] ?? 'development', scrubMessages: true },
{{/if}}
{{#if http.any}}
  authenticator: offlineAuthenticator,
{{/if}}
{{#if search.opensearch}}
  // The copies of a person in the read models of OpenSearch are reached on the node of the application.
  search: loadConfig(process.env).search,
{{/if}}
});

{{#if tenancy.any}}
const tenants = await tenantDirectory(persistence, fixedTenants).tenants();

if (tenants.length === 0) {
  console.error('The tenant directory lists no tenant to gather the records in. Name them in TENANTS, comma separated, or open an organisation first.');
  await application.stop();
  await persistence.close();
  process.exit(2);
}
{{/if}}

try {
  const document = await runExport(subject, {
    container: application.container,
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
