import type { Config } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import type { Workspace } from '../../workspace/index.js';
import { dependenciesFor } from './dependencies-for.js';
import { isRecord } from '../is-record.js';
import { scriptsFor } from './scripts-for.js';
import { VERSIONS } from './versions.js';

export interface ManifestRequest {
  readonly config: Config;
  readonly projectName: string;
  readonly force: boolean;
}

/** Creates package.json, or adds what is missing to an existing one without touching what is there. */
export function writeManifest(ws: Workspace, request: ManifestRequest): void {
  const scripts = scriptsFor(request.config);
  const wanted = dependenciesFor(request.config);
  const existing = ws.read('package.json');

  if (existing === undefined) {
    ws.create('package.json', serialize({ name: request.projectName, version: '0.1.0', private: true, type: 'module', engines: { node: '>=22.12.0' }, scripts, ...wanted }));

    return;
  }

  const manifest = parseManifest(existing);
  const merge = mergeInto(ws, manifest, request.force);

  merge('scripts', scripts, (name) => `package.json keeps its own "${name}" script; the kit expects: ${scripts[name] ?? ''}`);
  merge('dependencies', wanted.dependencies, keptRange);
  merge('devDependencies', wanted.devDependencies, keptRange);

  if (manifest['type'] === undefined) manifest['type'] = 'module';
  else if (manifest['type'] !== 'module') ws.note('package.json is not "type": "module"; the generated code is written as ES modules.');

  ws.update('package.json', serialize(manifest));
}

const serialize = (manifest: unknown): string => `${JSON.stringify(manifest, null, 2)}\n`;
const keptRange = (name: string): string => `package.json keeps its own range for ${name}; the kit was built against ${VERSIONS[name] ?? 'latest'}.`;

function parseManifest(text: string): Record<string, unknown> {
  let manifest: unknown;

  try {
    manifest = JSON.parse(text);
  } catch {
    throw new CliError('package.json is not valid JSON.', 'Fix its syntax, then run `ddd-ts-kit init` again.');
  }

  if (isRecord(manifest)) return manifest;

  throw new CliError('package.json must hold a JSON object.', 'Fix it, then run `ddd-ts-kit init` again.');
}

type Merge = (key: string, additions: Record<string, string>, kept: (name: string) => string) => void;

function mergeInto(ws: Workspace, manifest: Record<string, unknown>, force: boolean): Merge {
  return (key, additions, kept) => {
    const current = isRecord(manifest[key]) ? manifest[key] : {};

    for (const [name, value] of Object.entries(additions)) {
      if (current[name] === undefined || force) current[name] = value;
      else if (current[name] !== value) ws.note(kept(name));
    }

    manifest[key] = current;
  };
}
