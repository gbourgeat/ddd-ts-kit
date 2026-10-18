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
 * running CLI. A project inside a workspace is installed where the lockfile of the workspace is,
 * its packages resolved as Node does, from the project up to there. Reads the files only: no
 * package manager runs.
 */
export function installFindings(
  root: string,
  manager: Stack['packageManager'],
  declared: Readonly<Record<string, unknown>>,
): DoctorFinding[] {
  const installRoot = installRootOf(root, manager);

  if (!fs.existsSync(path.join(installRoot, 'node_modules'))) {
    return [{ area: 'install', name: 'node_modules', problem: 'missing', expected: 'the dependencies installed' }];
  }

  return [...freshnessFindings(installRoot, manager), ...kitFindings(modulesFrom(root, installRoot), declared)];
}

/**
 * The project, unless it has no lockfile of its own and a workspace above it holds one: the
 * nearest directory up whose package.json declares `workspaces`, or that has a
 * `pnpm-workspace.yaml`, and the lockfile.
 */
function installRootOf(root: string, manager: Stack['packageManager']): string {
  if (fs.existsSync(path.join(root, LOCKFILES[manager]))) {
    return root;
  }

  for (let directory = path.dirname(path.resolve(root)); ; directory = path.dirname(directory)) {
    if (isWorkspaceRoot(directory) && fs.existsSync(path.join(directory, LOCKFILES[manager]))) {
      return directory;
    }

    if (path.dirname(directory) === directory) {
      return root;
    }
  }
}

function isWorkspaceRoot(directory: string): boolean {
  if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
    return true;
  }

  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));

    return isRecord(manifest) && manifest['workspaces'] !== undefined;
  } catch {
    return false;
  }
}

/** The node_modules folders Node reads for the project, nearest first, up to the one of the install. */
function modulesFrom(root: string, installRoot: string): string[] {
  const folders: string[] = [];

  for (let directory = path.resolve(root); ; directory = path.dirname(directory)) {
    folders.push(path.join(directory, 'node_modules'));

    if (directory === path.resolve(installRoot) || path.dirname(directory) === directory) {
      return folders.filter((folder) => fs.existsSync(folder));
    }
  }
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

function kitFindings(modules: readonly string[], declared: Readonly<Record<string, unknown>>): DoctorFinding[] {
  const names = new Set([
    ...Object.keys(declared).filter((name) => OF_THE_KIT.test(name)),
    ...modules.flatMap(installedKit),
  ]);

  return [...names].sort(cliFirst).flatMap((name): DoctorFinding[] => {
    const found = resolvedVersionOf(modules, name);

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

/** The version of the first copy of a package Node would load, nearest node_modules first. */
function resolvedVersionOf(modules: readonly string[], name: string): string | undefined {
  const folder = modules.find((candidate) => fs.existsSync(path.join(candidate, name, 'package.json')));

  return folder === undefined ? undefined : versionOf(path.join(folder, name, 'package.json'));
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
