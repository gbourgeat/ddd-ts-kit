import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import { allowBuildsBlock } from '../init/manifest/allow-builds-block';
import { allowBuildsEntries, type AllowBuildsEntry } from '../init/manifest/allow-builds-entries';
import { installScriptsOf, type InstallScript } from '../init/manifest/install-scripts-of';
import { namesPackage } from '../init/manifest/names-package';
import type { DoctorFinding } from './doctor-finding';
import { installedFrom } from './installed-from';

/** Where the package manager of the project reads which install scripts run. */
interface AllowList {
  readonly where: string;
  readonly entries: readonly AllowBuildsEntry[];
}

/**
 * Each package of the stack whose install script the project needs, judged on the version
 * installed against the allow list of its package manager: not allowed at all, allowed for other
 * versions only (a pin the last bump left behind), or denied. npm reads a name alone, `name@*`, or
 * exact versions joined by `||`, and a denial wins; pnpm reads the same keys. A package not
 * installed is not judged. Reads the files only: no package manager runs.
 */
export function installScriptFindings(root: string, config: Config, manifest: unknown): DoctorFinding[] {
  const list = allowListOf(root, config, manifest);

  return installScriptsOf(config.stack).flatMap((script) => {
    const version = installedVersion(root, script);

    return version === undefined ? [] : judged(script, version, list);
  });
}

function judged({ name }: InstallScript, version: string, { where, entries }: AllowList): DoctorFinding[] {
  const own = entries.filter(({ key }) => namesPackage(key, name));
  const covering = own.filter(({ key }) => covers(key, name, version));

  if (covering.length > 0 && covering.every(({ allowed }) => allowed)) {
    return [];
  }

  const finding = { area: 'install-script', name, expected: `${name}@${version} allowed in ${where}` } as const;

  return [{ ...finding, ...problemOf(covering.length > 0 ? covering : own.filter(({ allowed }) => allowed), version) }];
}

/** What keeps the installed version from running its script: a denial, pins of other versions, or no entry at all. */
function problemOf(entries: readonly AllowBuildsEntry[], version: string): Pick<DoctorFinding, 'problem' | 'found'> {
  const keys = (allowed: boolean): string =>
    entries
      .filter((entry) => entry.allowed === allowed)
      .map(({ key }) => key)
      .join(', ');

  if (entries.some(({ allowed }) => !allowed)) {
    return { problem: 'written otherwise', found: `denied: ${keys(false)}` };
  }

  return entries.length > 0
    ? { problem: 'other version', found: `allowed for ${keys(true)}` }
    : { problem: 'missing', found: `${version} installed, its script unreviewed` };
}

/** Whether a key allows or denies the installed version: the name alone, `name@*`, or that exact version among those it joins with `||`. */
function covers(key: string, name: string, version: string): boolean {
  if (key === name) {
    return true;
  }

  const versions = key
    .slice(name.length + 1)
    .split('||')
    .map((one) => one.trim());

  return versions.includes('*') || versions.includes(version);
}

function allowListOf(root: string, config: Config, manifest: unknown): AllowList {
  if (config.stack.packageManager === 'pnpm') {
    const file = path.join(root, 'pnpm-workspace.yaml');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';

    return { where: 'allowBuilds of pnpm-workspace.yaml', entries: allowBuildsEntries(allowBuildsBlock(text) ?? '') };
  }

  const listed = isRecord(manifest) && isRecord(manifest['allowScripts']) ? manifest['allowScripts'] : {};

  return {
    where: 'allowScripts of package.json',
    entries: Object.entries(listed).flatMap(([key, value]) =>
      typeof value === 'boolean' ? [{ key, allowed: value }] : [],
    ),
  };
}

/** The version of the package as Node resolves it down the chain that brings it, from the real place of each package. */
function installedVersion(root: string, { through }: InstallScript): string | undefined {
  let from = root;

  for (const name of through) {
    const directory = installedFrom(from, name);

    if (directory === undefined) {
      return undefined;
    }

    from = directory;
  }

  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(from, 'package.json'), 'utf8'));

    return isRecord(manifest) && typeof manifest['version'] === 'string' ? manifest['version'] : undefined;
  } catch {
    return undefined;
  }
}
