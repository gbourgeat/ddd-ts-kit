import fs from 'node:fs';
import path from 'node:path';
import { formDocumentsOf } from '@ddd-ts-kit/http';
import { generateOpenApi, routesByDocument } from '@ddd-ts-kit/http/openapi';
import { contractFormat, stringifyContract } from 'ddd-ts-kit/dist/contracts.js';
import { offlineAuthenticator } from '@/platform/auth/authentication/offline-authenticator';
import { securitySchemes } from '@/platform/auth/authentication/security-schemes';
import { composeApplication } from '@/platform/composition/compose-application';
import { inertPersistence } from '@/platform/database/inert-persistence';
import { inProcessEvents } from '@/platform/events/in-process-events';
import { OPENAPI_DOCUMENTS } from '@/platform/http/openapi-documents';

// Generates the contract from the route definitions: openapi/openapi.yaml, or one file per
// document of "openapi.documents" in ddd-ts-kit.config.json, in the format of "openapi.format";
// the form of every route that declares one, whole, in openapi/forms/<operationId>.json;
// with --check, fails when a committed file differs. Build products: never edit them by hand.
const directory = path.resolve('openapi');
const format = contractFormat();

const application = composeApplication(inertPersistence(), {
  events: inProcessEvents(),
  authenticator: offlineAuthenticator,
});

const generated = new Map([
  ...routesByDocument(application.routes, OPENAPI_DOCUMENTS).map(({ name, title, routes }): [string, string] => [
    `${name}.${format}`,
    stringifyContract(
      generateOpenApi({
        info: { title: title ?? manifestField('name', 'scheduling'), version: manifestField('version', '0.0.0') },
        routes,
        securitySchemes,
        errorMapper: application.boundary.errorMapper,
        representations: application.boundary.representations,
      }),
      format,
    ),
  ]),
  ...(await formDocumentsOf(application.routes)).map((form): [string, string] => [
    `forms/${form.operation}.json`,
    `${JSON.stringify({ jsonForms: form.jsonForms, blocks: form.blocks }, null, 2)}\n`,
  ]),
]);

if (process.argv.includes('--check')) {
  reportDrift();
} else {
  for (const file of staleFiles()) {
    fs.rmSync(path.join(directory, file));
  }

  for (const [file, content] of generated) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), content);
  }
}

function reportDrift(): void {
  for (const [file, content] of generated) {
    const target = path.join(directory, file);
    const committed = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';

    if (committed.replaceAll('\r\n', '\n') !== content) {
      console.error(`openapi/${file} is out of date: run the script \`docs:generate\` and commit it.`);
      process.exitCode = 1;
    }
  }

  for (const file of staleFiles()) {
    console.error(`openapi/${file} is no document of the contract any more: run the script \`docs:generate\`.`);
    process.exitCode = 1;
  }
}

/** The contracts left by another format or by a document that is gone, and the forms of routes that declare none any more. */
function staleFiles(): string[] {
  const forms = path.join(directory, 'forms');
  const formFiles = fs.existsSync(forms) ? fs.readdirSync(forms).map((file) => `forms/${file}`) : [];
  const present = [...(fs.existsSync(directory) ? fs.readdirSync(directory) : []), ...formFiles];

  return present.filter((file) => /\.(?:json|yaml)$/.test(file) && !generated.has(file));
}

function manifestField(name: string, fallback: string): string {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

  if (typeof manifest !== 'object' || manifest === null) {
    return fallback;
  }

  const value: unknown = Reflect.get(manifest, name);

  return typeof value === 'string' ? value : fallback;
}
