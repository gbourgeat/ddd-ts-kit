import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMON_FLAGS } from '../src/commands/generate-options';
import { KINDS } from '../src/generate/kinds';
import { usageOf } from '../src/generate/usage-of';
import { REPO_ROOT } from './helpers';

const SOURCES = path.join(REPO_ROOT, 'packages/cli/src');
const KINDS_DIRECTORY = path.join(SOURCES, 'generate/kinds');
const KIND_FLAGS = fs.readFileSync(path.join(SOURCES, 'generate/kind.ts'), 'utf8');

/** The fields of `KindFlags`, each the reading of one flag of the command line, but the probe of `plan-waves`. */
const FIELDS = new Set(
  [
    ...KIND_FLAGS.slice(
      KIND_FLAGS.indexOf('export interface KindFlags'),
      KIND_FLAGS.indexOf('export interface KindRequest'),
    ).matchAll(/^\s+readonly (\w+)\??:/gm),
  ].flatMap((match) => (match[1] === undefined || match[1] === 'language' ? [] : [match[1]])),
);

/** The flag a field reads: `tenantScoped` is `--tenant-scoped`, `commandName` the `--command <UseCase>` of a job. */
const FLAG_OF: Readonly<Record<string, string>> = { commandName: 'command', timeZone: 'time-zone' };

/**
 * Flags the sources a kind runs read, and that its command line still refuses, with the reason.
 * A new line here is a decision about the kind, not a way to turn the spec green.
 */
const READ_WITH_FLAGS_OF_ITS_OWN: Readonly<Record<string, { readonly flags: readonly string[]; why: string }>> = {
  context: {
    flags: ['version', 'tenant-scoped', 'personal', 'subject', 'erasure', 'retention'],
    why: '--preset runs the kinds of the preset with the flags the preset gives them',
  },
  command: {
    flags: ['tenant-scoped', 'personal', 'subject', 'erasure', 'retention'],
    why: 'the repository a command writes on its first use takes the defaults; generate repository takes these flags',
  },
  'file-upload': {
    flags: ['command', 'query', 'mapper', 'serializer', 'cache'],
    why: 'an upload sets --command itself and has no request mapper, serializer or cache policy of its own',
  },
  policy: {
    flags: ['grant', 'public'],
    why: 'the use cases a policy writes again keep the access they were generated with',
  },
};

function resolved(from: string, specifier: string): string | undefined {
  const base = path.resolve(path.dirname(from), specifier);

  return [`${base}.ts`, `${base}/index.ts`].find((candidate) => fs.existsSync(candidate));
}

/** A source and every source it imports a value from, relative imports followed to the end. */
function closureOf(file: string, seen = new Set<string>()): Set<string> {
  seen.add(file);

  const imported = [...fs.readFileSync(file, 'utf8').matchAll(/^import (?!type )[^;]*? from '(\.[^']*)';/gm)];

  for (const next of imported.flatMap((match) => resolved(file, match[1] ?? '') ?? [])) {
    if (!seen.has(next)) {
      closureOf(next, seen);
    }
  }

  return seen;
}

/** The fields of the flags a source reads: `flags.permission`, `const { prefix, role } = scope.flags`. */
function fieldsReadBy(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const dotted = [...source.matchAll(/flags\??\.([a-zA-Z]+)/g)].map((match) => match[1] ?? '');

  const destructured = [...source.matchAll(/\{([^{}]*)\}\s*=\s*[\w.]*flags\b/g)].flatMap((match) =>
    (match[1] ?? '').split(',').map((part) => part.trim().split(/[:=\s]/)[0] ?? ''),
  );

  return [...dotted, ...destructured].filter((field) => FIELDS.has(field));
}

function sourceOf(kind: string): string {
  const declaration = `export const ${kind.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}Kind`;

  const file = fs
    .readdirSync(KINDS_DIRECTORY)
    .map((name) => path.join(KINDS_DIRECTORY, name))
    .find((candidate) => candidate.endsWith('.ts') && fs.readFileSync(candidate, 'utf8').includes(declaration));

  if (file === undefined) {
    throw new Error(`No source declares ${declaration}.`);
  }

  return file;
}

/** The flags the sources of a kind read that neither its usage, the common flags nor a decision above account for. */
function unshown(kind: (typeof KINDS)[number]): string[] {
  // `--module` is in the usage of the kinds that write into a module; the others refuse it, saying why.
  const shown = new Set([
    ...COMMON_FLAGS,
    'module',
    ...[...usageOf(kind).matchAll(/--([a-z-]+)/g)].map((match) => match[1]),
    ...(READ_WITH_FLAGS_OF_ITS_OWN[kind.name]?.flags ?? []),
  ]);

  const read = [...closureOf(sourceOf(kind.name))].flatMap(fieldsReadBy);
  const flags = read.map((field) => FLAG_OF[field] ?? field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));

  return [...new Set(flags)].filter((flag) => !shown.has(flag));
}

describe('the usage of each kind of generate', () => {
  it.each(KINDS.map((kind) => [kind.name, kind] as const))(
    'shows every flag the sources of %s read, the flags every kind takes aside',
    (_name, kind) => {
      expect(unshown(kind)).toEqual([]);
    },
  );

  it('reads, in the sources of a kind, the flags a helper it calls reads', () => {
    expect(fieldsReadBy(path.join(SOURCES, 'generate/access-vars.ts'))).toEqual(
      expect.arrayContaining(['permission', 'public']),
    );

    expect([...closureOf(sourceOf('command'))]).toContain(path.join(SOURCES, 'generate/access-vars.ts'));
  });
});
