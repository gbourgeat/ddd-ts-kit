import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { executionContext, type Actor } from '@ddd-ts-kit/kernel';
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
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { runPurge } from '{{alias.platform}}/privacy/run-purge{{alias.ext}}';

// The storage limitation (GDPR, article 5(1)(e)), from the command line, as the job
// `privacy.purge-expired` runs it every night:
//   npm run privacy:purge [-- --operator <who-runs-it>]
// Every copy listed in src/platform/privacy/data-subject-copies.ts erases the rows that outlived the
// retention their declaration gives, as it says{{#if tenancy.any}}, in every tenant{{/if}}. The report says the rows each
// context reached; run again, a purge reaches nothing{{#if audit.on}}, and every run leaves its entry in the audit trail{{/if}}.
const { values } = parseArgs({ options: { operator: { type: 'string', default: os.userInfo().username } } });

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
  log: { level: 'error', format: 'json', service: 'privacy-purge', environment: process.env['NODE_ENV'] ?? 'development', scrubMessages: true },
{{/if}}
{{#if http.any}}
  authenticator: offlineAuthenticator,
{{/if}}
{{#if search.opensearch}}
  // The copies of a person in the read models of OpenSearch are reached on the node of the application.
  search: loadConfig(process.env).search,
{{/if}}
});

const actor: Actor = { id: values.operator, type: 'user', roles: [], attributes: {} };
const context = executionContext({ correlationId: randomUUID(), actor, origin: 'cli' });

try {
  const report = await application.platform.scope.run(context, () => runPurge(application.platform));

  console.log(JSON.stringify(report, null, 2));
} finally {
  await application.stop();
  await persistence.close();
}
