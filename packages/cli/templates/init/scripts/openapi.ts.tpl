import fs from 'node:fs';
import path from 'node:path';
{{#if presentation.forms}}
import { formDocumentsOf } from '@ddd-ts-kit/http';
{{/if}}
import { generateOpenApi, routesByDocument } from '@ddd-ts-kit/http/openapi';
import { contractFormat, stringifyContract } from 'ddd-ts-kit/dist/contracts.js';
import { offlineAuthenticator } from '{{alias.platform}}/auth/authentication/offline-authenticator{{alias.ext}}';
import { securitySchemes } from '{{alias.platform}}/auth/authentication/security-schemes{{alias.ext}}';
import { composeApplication } from '{{alias.platform}}/compose-application{{alias.ext}}';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence{{alias.ext}}';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { OPENAPI_DOCUMENTS } from '{{alias.platform}}/http/openapi-documents{{alias.ext}}';

// Generates the contract from the route definitions: openapi/openapi.yaml, or one file per
// document of "openapi.documents" in ddd-ts-kit.config.json, in the format of "openapi.format";
{{#if presentation.forms}}
// the form of every route that declares one, whole, in openapi/forms/<operationId>.json;
{{/if}}
// with --check, fails when a committed file differs. Build products: never edit them by hand.
const directory = path.resolve('openapi');

// What init leaves when the routes are known only to the running application (a preset): the
// first check writes the contract, to commit; on a pipeline (CI set), it fails until it is.
const PENDING = 'x-ddd-ts-kit-pending';
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
        info: { title: title ?? manifestField('name', '{{project.name}}'), version: manifestField('version', '0.0.0') },
        routes,
        securitySchemes,
        errorMapper: application.boundary.errorMapper,
{{#if presentation.negotiated}}
        representations: application.boundary.representations,
{{/if}}
      }),
      format,
    ),
  ]),
{{#if presentation.forms}}
  ...(await formDocumentsOf(application.routes)).map((form): [string, string] => [
    `forms/${form.operation}.json`,
    `${JSON.stringify({ jsonForms: form.jsonForms, blocks: form.blocks }, null, 2)}\n`,
  ]),
{{/if}}
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
    const contract = path.join(directory, file);
    const committed = fs.existsSync(contract) ? fs.readFileSync(contract, 'utf8') : '';

    if (committed.includes(PENDING)) {
      writeFirst(file, content);
    } else if (committed.replaceAll('\r\n', '\n') !== content) {
      console.error(`openapi/${file} is out of date: run the script \`docs:generate\` and commit it.`);
      process.exitCode = 1;
    }
  }

  for (const file of staleFiles()) {
    console.error(`openapi/${file} is no document of the contract any more: run the script \`docs:generate\`.`);
    process.exitCode = 1;
  }
}

function writeFirst(file: string, content: string): void {
  if (process.env['CI'] !== undefined) {
    console.error(`openapi/${file} was never generated: run the script \`docs:generate\` and commit it.`);
    process.exitCode = 1;

    return;
  }

  fs.writeFileSync(path.join(directory, file), content);
  console.error(`openapi/${file} is written for the first time, from the routes of the application: commit it.`);
}

/** The contracts left by another format or by a document that is gone{{#if presentation.forms}}, and the forms of routes that declare none any more{{/if}}: what else the folder holds is left alone. */
function staleFiles(): string[] {
{{#if presentation.forms}}
  const forms = path.join(directory, 'forms');
  const formFiles = fs.existsSync(forms) ? fs.readdirSync(forms).map((file) => `forms/${file}`) : [];
  const present = [...(fs.existsSync(directory) ? fs.readdirSync(directory) : []), ...formFiles];
{{/if}}
{{#unless presentation.forms}}
  const present = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
{{/unless}}

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
