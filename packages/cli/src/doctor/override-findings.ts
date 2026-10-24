import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import { PINNED_BELOW_A_FIX, type PinnedBelowAFix } from '../init/manifest/pinned-below-a-fix';
import type { DoctorFinding } from './doctor-finding';
import { inRange } from './in-range';

/**
 * The versions init forces under a dependency that pins one below a security fix, judged on what
 * is installed: an override the project needs and lacks, and one it keeps once that dependency
 * asks for the fixed version itself, which would hold the package back on its next major. A chain
 * that is not installed, or a range that cannot be read, is not judged.
 */
export function overrideFindings(root: string, config: Config, manifest: unknown): DoctorFinding[] {
  const file = config.stack.packageManager === 'pnpm' ? 'pnpm-workspace.yaml' : 'package.json';
  const forced = forcedIn(root, file, manifest);

  return PINNED_BELOW_A_FIX.filter((pin) => pin.applies(config)).flatMap((pin) =>
    findingsOf(pin, { asked: askedOf(root, pin), forced: forced(pin.name), file }),
  );
}

interface Asked {
  readonly parent: string;
  readonly range: string;
}

/** What the checkout holds of one pin: the range its parent asks for, installed, and whether the project forces it. */
interface Installed {
  readonly asked: Asked | undefined;
  readonly forced: boolean;
  readonly file: string;
}

function findingsOf(pin: PinnedBelowAFix, { asked, forced, file }: Installed): DoctorFinding[] {
  const fixedAllowed = asked === undefined ? undefined : inRange(pin.fixed, asked.range);

  if (asked === undefined || fixedAllowed === undefined || fixedAllowed !== forced) {
    return [];
  }

  const asks = `${asked.parent} asks for ${pin.name} ${asked.range}`;

  return [
    forced
      ? {
          area: 'override',
          name: pin.name,
          problem: 'no longer needed',
          expected: `no override: ${asks}`,
          found: `${pin.name} forced in overrides of ${file}`,
        }
      : {
          area: 'override',
          name: pin.name,
          problem: 'missing',
          expected: `${pin.name} ${pin.range} in overrides of ${file}`,
          found: asks,
        },
  ];
}

/** The range the last package of the chain asks for, the chain resolved as Node does from the real place of each package. */
function askedOf(root: string, pin: PinnedBelowAFix): Asked | undefined {
  let from = root;
  let manifest: Record<string, unknown> | undefined;

  for (const name of pin.through) {
    const directory = installedFrom(from, name);

    manifest = directory === undefined ? undefined : manifestIn(directory);

    if (directory === undefined || manifest === undefined) {
      return undefined;
    }

    from = directory;
  }

  const range = isRecord(manifest?.['dependencies']) ? manifest['dependencies'][pin.name] : undefined;
  const parent = pin.through.at(-1);

  return typeof range === 'string' && parent !== undefined ? { parent, range } : undefined;
}

function installedFrom(start: string, name: string): string | undefined {
  for (let directory = path.resolve(start); ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', name);

    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return fs.realpathSync(candidate);
    }

    if (path.dirname(directory) === directory) {
      return undefined;
    }
  }
}

function manifestIn(directory: string): Record<string, unknown> | undefined {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));

    return isRecord(manifest) ? manifest : undefined;
  } catch {
    return undefined;
  }
}

/** Whether the project forces a package: in `overrides` of package.json, or in the `overrides:` block of pnpm-workspace.yaml. */
function forcedIn(root: string, file: string, manifest: unknown): (name: string) => boolean {
  if (file === 'package.json') {
    const overrides = isRecord(manifest) && isRecord(manifest['overrides']) ? manifest['overrides'] : {};

    return (name) => overrides[name] !== undefined;
  }

  const text = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
  const block = /^overrides:\n((?:[ \t]+.*\n?|\n)*)/m.exec(text)?.[1] ?? '';

  return (name) => new RegExp(`^\\s+['"]?${name}['"]?:`, 'm').test(block);
}
