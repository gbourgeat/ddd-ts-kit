import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config/index.js';
import { isRecord } from '../config/values/is-record.js';
import type { DoctorFinding } from './doctor-finding.js';
import { hookFindings } from './hook-findings.js';
import { packageFindings } from './package-findings.js';
import { permissionFindings } from './permission-findings.js';
import { scriptFindings } from './script-findings.js';

/**
 * What the project lacks of what this version of the kit writes, the steps an upgrade leaves to do:
 * scripts, packages of the kit, permissions of the agents, then the git hooks of this clone.
 * Settings the project does not have are not judged: an agent may run elsewhere than Claude Code.
 */
export function diagnose(root: string, config: Config): DoctorFinding[] {
  const manifest = readJson(path.join(root, 'package.json'));
  const scripts = isRecord(manifest) && isRecord(manifest['scripts']) ? manifest['scripts'] : {};

  const installed = {
    ...(isRecord(manifest) && isRecord(manifest['dependencies']) ? manifest['dependencies'] : {}),
    ...(isRecord(manifest) && isRecord(manifest['devDependencies']) ? manifest['devDependencies'] : {}),
  };

  const settingsFile = path.join(root, '.claude', 'settings.json');

  return [
    ...scriptFindings(config, scripts),
    ...packageFindings(config, installed),
    ...(fs.existsSync(settingsFile) ? permissionFindings(config, readJson(settingsFile)) : []),
    ...hookFindings(root),
  ];
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}
