import fs from 'node:fs';
import path from 'node:path';
import { generateOpenApi, routesByDocument } from '@ddd-ts-kit/http/openapi';
import { contractFormat, stringifyContract } from 'ddd-ts-kit/dist/contracts.js';
import { offlineAuthenticator } from '{{alias.platform}}/auth/offline-authenticator{{alias.ext}}';
import { securitySchemes } from '{{alias.platform}}/auth/security-schemes{{alias.ext}}';
import { composeApplication } from '{{alias.platform}}/compose-application{{alias.ext}}';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence{{alias.ext}}';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
import { OPENAPI_DOCUMENTS } from '{{alias.platform}}/http/openapi-documents{{alias.ext}}';

// Generates the contract from the route definitions: openapi/openapi.yaml, or one file per
// document of "openapi.documents" in ddd-ts-kit.config.json, in the format of "openapi.format";
// with --check, fails when a committed file differs. Build products: never edit them by hand.
const directory = path.resolve('openapi');
const format = contractFormat();

const application = composeApplication(inertPersistence(), {
  events: inProcessEvents(),
  authenticator: offlineAuthenticator,
});

const generated = new Map(
  routesByDocument(application.routes, OPENAPI_DOCUMENTS).map(({ name, title, routes }) => [
    `${name}.${format}`,
    stringifyContract(
      generateOpenApi({
        info: { title: title ?? manifestField('name', '{{project.name}}'), version: manifestField('version', '0.0.0') },
        routes,
        securitySchemes,
        errorMapper: application.boundary.errorMapper,
      }),
      format,
    ),
  ]),
);

if (process.argv.includes('--check')) {
  reportDrift();
} else {
  fs.mkdirSync(directory, { recursive: true });

  for (const file of staleFiles()) {
    fs.rmSync(path.join(directory, file));
  }

  for (const [file, content] of generated) {
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

/** The contracts left by another format or by a document that is gone. */
function staleFiles(): string[] {
  const present = fs.existsSync(directory) ? fs.readdirSync(directory) : [];

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
