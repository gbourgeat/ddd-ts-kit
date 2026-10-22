import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import type { DoctorFinding } from './doctor-finding';
import { folderFindings } from './folder-findings';
import { guidanceFindings } from './guidance-findings';
import { hookFindings } from './hook-findings';
import { installFindings } from './install-findings';
import { nodeFindings } from './node-findings';
import { packageFindings } from './package-findings';
import { permissionFindings } from './permission-findings';
import { scriptFindings } from './script-findings';
import { submoduleFindings } from './submodule-findings';
import { platformFileIn } from '../platform-layout';

/**
 * What the project lacks of what this version of the kit writes, the steps an upgrade leaves to do:
 * scripts, packages of the kit, permissions of the agents, the git hooks of this clone, the review
 * policy, then the files of the platform this version gives a folder.
 * Settings the project does not have are not judged: an agent may run elsewhere than Claude Code.
 * Then what this checkout lacks to run it: the Node it asks, its dependencies installed, the
 * packages of the kit at the version of this CLI, its submodules.
 */
export function diagnose(root: string, config: Config): DoctorFinding[] {
  const manifest = readJson(path.join(root, 'package.json'));
  const scripts = isRecord(manifest) && isRecord(manifest['scripts']) ? manifest['scripts'] : {};

  const declared = {
    ...(isRecord(manifest) && isRecord(manifest['dependencies']) ? manifest['dependencies'] : {}),
    ...(isRecord(manifest) && isRecord(manifest['devDependencies']) ? manifest['devDependencies'] : {}),
  };

  const settingsFile = path.join(root, '.claude', 'settings.json');

  return [
    ...scriptFindings(config, scripts, tracingOf(root, config)),
    ...packageFindings(config, declared),
    ...(fs.existsSync(settingsFile) ? permissionFindings(config, readJson(settingsFile)) : []),
    ...hookFindings(root),
    ...guidanceFindings(root, config),
    ...folderFindings(root, config),
    ...nodeFindings(process.versions.node, nodeEngine(manifest), readText(path.join(root, '.nvmrc'))),
    ...installFindings(root, config.stack.packageManager, declared),
    ...submoduleFindings(root),
  ];
}

/** Where the project keeps the module `dev` preloads: in its folder, or flat as a version before the folders wrote it. */
function tracingOf(root: string, config: Config): string {
  return platformFileIn(config, 'observability/tracing.ts', (file) => fs.existsSync(path.join(root, file)));
}

function nodeEngine(manifest: unknown): unknown {
  return isRecord(manifest) && isRecord(manifest['engines']) ? manifest['engines']['node'] : undefined;
}

function readText(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readText(file) ?? '');
  } catch {
    return undefined;
  }
}
