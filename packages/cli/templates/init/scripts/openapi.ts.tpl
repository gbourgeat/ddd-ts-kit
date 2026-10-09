import fs from 'node:fs';
import path from 'node:path';
import { checkOpenApiDrift, generateOpenApi, stringifyOpenApi } from '@ddd-ts-kit/http/openapi';
import { composeApplication } from '{{paths.scriptsToSource}}/platform/application.js';
import { inertPersistence } from '{{paths.scriptsToSource}}/platform/database/persistence.js';

// Generates openapi/openapi.json from the route definitions; with --check, fails when the
// committed file differs. The file is a build product: never edit it by hand.
const target = path.resolve('openapi/openapi.json');

const document = generateOpenApi({
  info: { title: manifestField('name', '{{project.name}}'), version: manifestField('version', '0.0.0') },
  routes: composeApplication(inertPersistence()).routes,
});

if (process.argv.includes('--check')) {
  const committed = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (checkOpenApiDrift(document, committed).drift) {
    console.error('openapi/openapi.json is out of date: run `npm run docs:generate` and commit the result.');
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, stringifyOpenApi(document));
}

function manifestField(name: string, fallback: string): string {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null) {
    return fallback;
  }
  const value: unknown = Reflect.get(manifest, name);
  return typeof value === 'string' ? value : fallback;
}
