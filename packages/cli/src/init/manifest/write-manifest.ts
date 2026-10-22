import type { Config } from '../../config';
import { CliError } from '../../cli-error';
import type { Workspace } from '../../workspace';
import { dependenciesFor, type Packages } from './dependencies-for';
import { formatJson } from '../../json/format-json';
import { PINNED_PACKAGE_MANAGERS } from '../../package-manager/pinned-package-managers';
import { isRecord } from '../is-record';
import { scriptsFor } from './scripts-for';
import { VERSIONS } from './versions';
import { platformFileIn } from '../../platform-layout';

export interface ManifestRequest {
  readonly config: Config;
  readonly projectName: string;
  readonly force: boolean;
}

/** Creates package.json, or adds what is missing to an existing one without touching what is there. */
export function writeManifest(ws: Workspace, request: ManifestRequest): void {
  const tracing = platformFileIn(request.config, 'observability/tracing.ts', (path) => ws.exists(path));
  const scripts = scriptsFor(request.config, tracing);
  const wanted = dependenciesFor(request.config);
  const existing = ws.read('package.json');

  if (existing === undefined) {
    ws.create('package.json', serialize(newManifest(request, scripts, wanted)));

    return;
  }

  const manifest = parseManifest(existing);
  const merge = mergeInto(ws, manifest, request.force);

  merge(
    'scripts',
    scripts,
    (name) => `package.json keeps its own "${name}" script; the kit expects: ${scripts[name] ?? ''}`,
  );

  merge('dependencies', wanted.dependencies, keptRange);
  merge('devDependencies', wanted.devDependencies, keptRange);

  if (manifest['type'] === undefined) {
    manifest['type'] = 'module';
  } else if (manifest['type'] !== 'module') {
    ws.note('package.json is not "type": "module"; the generated code is written as ES modules.');
  }

  pinPackageManager(ws, manifest, request);
  ws.update('package.json', serialize(manifest));
}

/** corepack reads `packageManager`: an existing project that pins another release keeps it, and is told. */
function pinPackageManager(ws: Workspace, manifest: Record<string, unknown>, { config, force }: ManifestRequest): void {
  const pinned = PINNED_PACKAGE_MANAGERS[config.stack.packageManager];

  if (pinned === undefined || manifest['packageManager'] === pinned) {
    return;
  }

  if (manifest['packageManager'] === undefined || force) {
    manifest['packageManager'] = pinned;
  } else {
    ws.note(`package.json keeps its own "packageManager"; the kit was proven with ${pinned}.`);
  }
}

function newManifest(
  { projectName, config }: ManifestRequest,
  scripts: Record<string, string>,
  wanted: Packages,
): Record<string, unknown> {
  const pinned = PINNED_PACKAGE_MANAGERS[config.stack.packageManager];

  return {
    name: projectName,
    version: '0.1.0',
    private: true,
    type: 'module',
    engines: { node: '>=22.12.0' },
    ...(pinned === undefined ? {} : { packageManager: pinned }),
    scripts,
    ...wanted,
  };
}

const serialize = (manifest: unknown): string => formatJson(manifest);

const keptRange = (name: string): string =>
  `package.json keeps its own range for ${name}; the kit was built against ${VERSIONS[name] ?? 'latest'}.`;

function parseManifest(text: string): Record<string, unknown> {
  let manifest: unknown;

  try {
    manifest = JSON.parse(text);
  } catch {
    throw new CliError('package.json is not valid JSON.', 'Fix its syntax, then run `ddd-ts-kit init` again.');
  }

  if (isRecord(manifest)) {
    return manifest;
  }

  throw new CliError('package.json must hold a JSON object.', 'Fix it, then run `ddd-ts-kit init` again.');
}

type Merge = (key: string, additions: Record<string, unknown>, kept: (name: string) => string) => void;

function mergeInto(ws: Workspace, manifest: Record<string, unknown>, force: boolean): Merge {
  return (key, additions, kept) => {
    const current = isRecord(manifest[key]) ? manifest[key] : {};

    for (const [name, value] of Object.entries(additions)) {
      if (current[name] === undefined || force) {
        current[name] = value;
      } else if (JSON.stringify(current[name]) !== JSON.stringify(value)) {
        ws.note(kept(name));
      }
    }

    manifest[key] = current;
  };
}
