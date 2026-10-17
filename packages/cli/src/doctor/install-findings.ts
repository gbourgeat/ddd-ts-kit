import fs from 'node:fs';
import path from 'node:path';
import type { Stack } from '../config/index.js';
import { isRecord } from '../config/values/is-record.js';
import { INSTALLED_LOCKFILES, LOCKFILES } from '../package-manager/lockfiles.js';
import { VERSION } from '../version.js';
import type { DoctorFinding } from './doctor-finding.js';
import { OF_THE_KIT } from './package-findings.js';

/**
 * What this checkout has installed: node_modules, installed since the lockfile last changed, then
 * each package of the kit package.json declares or node_modules holds, at the version of the
 * running CLI. Reads the files only: no package manager runs.
 */
export function installFindings(
  root: string,
  manager: Stack['packageManager'],
  declared: Readonly<Record<string, unknown>>,
): DoctorFinding[] {
  const modules = path.join(root, 'node_modules');

  if (!fs.existsSync(modules)) {
    return [{ area: 'install', name: 'node_modules', problem: 'missing', expected: 'the dependencies installed' }];
  }

  return [...freshnessFindings(root, manager), ...kitFindings(modules, declared)];
}

/** An install writes its copy of the lockfile last: a lockfile changed after it was changed by a pull, a merge or a checkout. */
function freshnessFindings(root: string, manager: Stack['packageManager']): DoctorFinding[] {
  const lockfile = modifiedAt(path.join(root, LOCKFILES[manager]));

  const installed =
    modifiedAt(path.join(root, INSTALLED_LOCKFILES[manager])) ?? modifiedAt(path.join(root, 'node_modules'));

  return lockfile !== undefined && installed !== undefined && lockfile > installed
    ? [
        {
          area: 'install',
          name: 'node_modules',
          problem: 'outdated',
          expected: `installed after ${LOCKFILES[manager]} last changed`,
        },
      ]
    : [];
}

function kitFindings(modules: string, declared: Readonly<Record<string, unknown>>): DoctorFinding[] {
  const names = new Set([...Object.keys(declared).filter((name) => OF_THE_KIT.test(name)), ...installedKit(modules)]);

  return [...names].sort(cliFirst).flatMap((name): DoctorFinding[] => {
    const found = versionOf(path.join(modules, name, 'package.json'));

    if (found === undefined) {
      return [{ area: 'install', name, problem: 'not installed', expected: VERSION }];
    }

    return found === VERSION ? [] : [{ area: 'install', name, problem: 'other version', expected: VERSION, found }];
  });
}

function installedKit(modules: string): string[] {
  const scoped = path.join(modules, '@ddd-ts-kit');
  const cli = fs.existsSync(path.join(modules, 'ddd-ts-kit')) ? ['ddd-ts-kit'] : [];

  return fs.existsSync(scoped) ? [...cli, ...fs.readdirSync(scoped).map((name) => `@ddd-ts-kit/${name}`)] : cli;
}

function cliFirst(left: string, right: string): number {
  return Number(left !== 'ddd-ts-kit') - Number(right !== 'ddd-ts-kit') || left.localeCompare(right);
}

function versionOf(manifest: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'));

    return isRecord(parsed) && typeof parsed['version'] === 'string' ? parsed['version'] : undefined;
  } catch {
    return undefined;
  }
}

function modifiedAt(file: string): number | undefined {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
}
