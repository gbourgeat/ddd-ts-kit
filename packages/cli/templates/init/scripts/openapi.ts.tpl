import fs from 'node:fs';
import path from 'node:path';
import { checkOpenApiDrift, generateOpenApi, stringifyOpenApi } from '@ddd-ts-kit/http/openapi';
import { offlineAuthenticator } from '{{alias.platform}}/auth/offline-authenticator.js';
import { securitySchemes } from '{{alias.platform}}/auth/security-schemes.js';
import { composeApplication } from '{{alias.platform}}/compose-application.js';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence.js';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events.js';

// Generates openapi/openapi.json from the route definitions; with --check, fails when the
// committed file differs. The file is a build product: never edit it by hand.
const target = path.resolve('openapi/openapi.json');

const application = composeApplication(inertPersistence(), {
  events: inProcessEvents(),
  authenticator: offlineAuthenticator,
});

const document = generateOpenApi({
  info: {
    title: manifestField('name', '{{project.name}}'),
    version: manifestField('version', '0.0.0'),
  },
  routes: application.routes,
  securitySchemes,
  errorMapper: application.boundary.errorMapper,
});

if (process.argv.includes('--check')) {
  reportDrift();
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, stringifyOpenApi(document));
}

function reportDrift(): void {
  const committed = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';

  if (!checkOpenApiDrift(document, committed).drift) {
    return;
  }

  console.error('openapi/openapi.json is out of date: run `npm run docs:generate` and commit the result.');
  process.exitCode = 1;
}

function manifestField(name: string, fallback: string): string {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

  if (typeof manifest !== 'object' || manifest === null) {
    return fallback;
  }

  const value: unknown = Reflect.get(manifest, name);

  return typeof value === 'string' ? value : fallback;
}
