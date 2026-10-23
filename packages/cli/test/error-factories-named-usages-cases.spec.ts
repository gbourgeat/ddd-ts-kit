import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cli, read, tempDir, write } from './helpers';

const ERRORS = 'src/contexts/scheduling/domain/errors';
const APPLICATION = 'src/contexts/scheduling/application';
const SLOT_ERROR = '@/contexts/scheduling/domain/errors/slot.error';
const PATTERN = 'src/contexts/*/*.codes.ts';

const TELL_KNIP = `Tell knip that the code types are a contract: add \`"ignoreIssues": { "${PATTERN}": ["types"] }\` to its config.`;

interface Applied {
  written: string[];
  manual: string[];
}

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

const SLOT = lines(
  "import { ConceptError } from '@ddd-ts-kit/kernel';",
  '',
  'export class SlotError extends ConceptError {',
  '  static taken(slotId: string) {',
  "    return SlotError.refusal('SLOT_TAKEN', `Slot ${slotId} is taken.`);",
  '  }',
  '}',
);

/** A project of the factories form whose `SlotError` builds one refusal, with `files` written in it and planned. */
function slotProject(files: Readonly<Record<string, string>> = {}): string {
  const root = tempDir('error-factories-named-usages');

  expect(cli(root, 'init', '--refusals', 'factories').code).toBe(0);

  expect(
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book').code,
  ).toBe(0);

  write(root, `${ERRORS}/slot.error.ts`, SLOT);

  for (const [file, text] of Object.entries(files)) {
    write(root, file, text);
  }

  expect(cli(root, 'error-factories', '--plan').code).toBe(0);

  return root;
}

const apply = (root: string): Applied => cli(root, 'error-factories', '--apply', '--json').json() as Applied;

describe('error-factories --apply to the named form, the imports of the concept class it rewrites', () => {
  let root: string;
  let applied: Applied;

  beforeAll(() => {
    root = slotProject({
      [`${APPLICATION}/take.ts`]: lines(
        `import { SlotError } from '${SLOT_ERROR}'`,
        '',
        'export const take = (slotId: string) => SlotError.taken(slotId)',
      ),
      [`${APPLICATION}/unused.ts`]: lines(`import { SlotError } from '${SLOT_ERROR}';`, '', 'export const one = 1;'),
      [`${APPLICATION}/one-line.ts`]: lines(`import { SlotError } from '${SLOT_ERROR}'; export const two = 2;`),
      [`${APPLICATION}/refused.ts`]: lines(
        "import type { RefusalOf } from '@ddd-ts-kit/kernel';",
        `import type { SlotError } from '${SLOT_ERROR}';`,
        '',
        'export type Refused<Code extends string> = RefusalOf<typeof SlotError, Code>;',
      ),
    });

    applied = apply(root);
  });

  it('imports the class of its own in place of an import written without its semicolon', () => {
    expect(read(root, `${APPLICATION}/take.ts`)).toBe(
      lines(
        "import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';",
        '',
        'export const take = (slotId: string) => SlotTaken.forSlot(slotId)',
      ),
    );
  });

  it('removes an import of the concept class that nothing reads, with its line or before the code that follows it', () => {
    expect(read(root, `${APPLICATION}/unused.ts`)).toBe(lines('', 'export const one = 1;'));
    expect(read(root, `${APPLICATION}/one-line.ts`)).not.toContain('SlotError');
    expect(read(root, `${APPLICATION}/one-line.ts`).trim()).toBe('export const two = 2;');
  });

  it('leaves a RefusalOf whose code is not a literal, and says the line that still names the concept class', () => {
    expect(read(root, `${APPLICATION}/refused.ts`)).toContain('RefusalOf<typeof SlotError, Code>;');

    expect(applied.manual).toContain(
      `${APPLICATION}/refused.ts:4: SlotError is gone: name the refusal classes that replace it there.`,
    );
  });
});

describe('error-factories --apply to the named form, the config of knip', () => {
  const KNIP = {
    $schema: 'https://unpkg.com/knip@6/schema.json',
    ignoreExportsUsedInFile: true,
    project: ['src/**/*.ts'],
  };

  it.each([
    ['not plain JSON', `// The config of knip.\n${JSON.stringify(KNIP)}\n`],
    ['not an object', '[]\n'],
  ])('says what knip is to be told when its knip.json is %s, and leaves the file', (_, knip) => {
    const root = slotProject({ 'knip.json': knip });
    const applied = apply(root);

    expect(applied.manual).toContain(TELL_KNIP);
    expect(applied.written).not.toContain('knip.json');
    expect(read(root, 'knip.json')).toBe(knip);
  });

  it.each([
    [
      'whose manifest does not name it',
      (root: string): void => {
        const manifest = JSON.parse(read(root, 'package.json')) as Record<string, Record<string, string> | undefined>;

        delete manifest['devDependencies']?.['knip'];

        for (const [name, script] of Object.entries(manifest['scripts'] ?? {})) {
          if (name === 'knip' || script.includes('knip')) {
            delete manifest['scripts']?.[name];
          }
        }

        write(root, 'package.json', JSON.stringify(manifest));
      },
    ],
    ['without a manifest', (root: string): void => fs.rmSync(path.join(root, 'package.json'))],
  ])('says nothing of knip in a project %s and without knip.json', (_, without) => {
    const root = slotProject();

    fs.rmSync(path.join(root, 'knip.json'));
    without(root);

    expect(apply(root).manual.join('\n')).not.toContain('knip');
  });

  it('adds the types to what knip already ignores in the code lists, and writes the issues last without the key init places them after', () => {
    const root = slotProject({
      'knip.json': JSON.stringify({ project: ['src/**/*.ts'], ignoreIssues: { [PATTERN]: ['files'] } }),
    });

    apply(root);

    expect(JSON.parse(read(root, 'knip.json'))).toEqual({
      project: ['src/**/*.ts'],
      ignoreIssues: { [PATTERN]: ['files', 'types'] },
    });

    const bare = slotProject({ 'knip.json': JSON.stringify({ project: ['src/**/*.ts'], ignore: [] }) });

    apply(bare);
    expect(Object.keys(JSON.parse(read(bare, 'knip.json')) as object)).toEqual(['project', 'ignore', 'ignoreIssues']);
  });

  it('leaves a knip.json that already ignores the code types', () => {
    const knip = `${JSON.stringify({ ...KNIP, ignoreIssues: { [PATTERN]: ['types'] } })}\n`;
    const root = slotProject({ 'knip.json': knip });

    expect(apply(root).written).not.toContain('knip.json');
    expect(read(root, 'knip.json')).toBe(knip);
  });
});
