import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read, write } from '../helpers';
import { eslintOn } from './analyzers';
import { compiledProject, PROBE, rewriteAliases } from './compiled-project';
import { bin, findingsOf, runIn } from './run-in';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const HANDLER = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
const COMMAND = '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
const AGGREGATE = '@/contexts/billing/domain/aggregates/invoice.aggregate';

/** The two spellings a project can take: the default of `init`, and the one kept for the projects written before it. */
const SPELLINGS = [
  ['no extension, as init writes it', [], ''],
  ['".js", asked with --import-extension js', ['--import-extension', 'js'], '.js'],
] as const;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): one generated project per spelling, an import written the
 * wrong way in it, and the two fixes of ESLint: a relative import becomes its alias, an import
 * takes the ending the config asks for. The formatter accepts each result.
 */
describe.runIf(SLOW).each(SPELLINGS)(
  'the import rules fix what they report in a generated project (%s)',
  (_spelling, flags, suffix) => {
    let root: string;
    const kept = new Map<string, string>();

    const edit = (file: string, change: (text: string) => string): void => {
      kept.set(file, kept.get(file) ?? read(root, file));
      write(root, file, change(read(root, file)));
    };

    beforeAll(() => {
      root = compiledProject(DEFAULT_STACK, flags);
    }, 240_000);

    afterEach(() => {
      kept.forEach((content, file) => write(root, file, content));
      kept.clear();
    });

    it('eslint --fix turns a relative import into its alias, the formatter accepts the result, and a second fix changes nothing', () => {
      edit(HANDLER, (text) => text.replace(`'${COMMAND}${suffix}'`, `'./issue-invoice.command${suffix}'`));

      expect(read(root, HANDLER)).toContain(`from './issue-invoice.command${suffix}';`);
      expect(findingsOf(root, eslintOn(HANDLER))).toContain('ddd-ts-kit/imports-alias-only');

      runIn(root, { command: bin('eslint'), args: ['--fix', HANDLER] });
      runIn(root, { command: bin('biome'), args: ['format', '--write', HANDLER] });

      const fixed = read(root, HANDLER);

      runIn(root, { command: bin('eslint'), args: ['--fix', HANDLER] });

      expect(fixed).toBe(kept.get(HANDLER));
      expect(read(root, HANDLER)).toBe(fixed);
      expect(findingsOf(root, { command: bin('biome'), args: ['format', HANDLER] })).toBe('');
    }, 240_000);

    it('an import written in the other spelling is reported by the checker and by ESLint, and eslint --fix gives it back the one of the config', () => {
      const other = suffix === '' ? '.js' : '';

      edit(HANDLER, (text) => text.replace(`'${AGGREGATE}${suffix}'`, `'${AGGREGATE}${other}'`));

      const checked = cli(root, 'check', '--rule', 'imports/extension', '--json').json();

      expect(read(root, HANDLER)).toContain(`from '${AGGREGATE}${other}';`);
      expect(checked).toMatchObject({ ok: false, violations: [{ ruleId: 'imports/extension', file: HANDLER }] });
      expect(findingsOf(root, eslintOn(HANDLER))).toContain('ddd-ts-kit/imports-extension');

      runIn(root, { command: bin('eslint'), args: ['--fix', HANDLER] });
      runIn(root, { command: bin('biome'), args: ['format', '--write', HANDLER] });

      expect(read(root, HANDLER)).toBe(kept.get(HANDLER));
      expect(cli(root, 'check', '--rule', 'imports/extension', '--json').json()).toMatchObject({ ok: true });
    }, 240_000);

    it.runIf(suffix === '')(
      'a directory is written as itself: the compiler completes it with its index, the checker lets it through and the build writes its index.js',
      () => {
        write(root, 'src/platform/shelf/index.ts', 'export const shelf = 1;\n');
        edit(PROBE, (text) => `${text}export { shelf } from '@/platform/shelf';\n`);

        const compiled = findingsOf(root, {
          command: process.execPath,
          args: [NATIVE_COMPILER, '-p', 'tsconfig.build.json'],
        });

        expect(compiled).toBe('');
        expect(cli(root, 'check', '--rule', 'imports/extension', '--json').json()).toMatchObject({ ok: true });
        runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.build.json'] });
        expect(() => rewriteAliases(root)).not.toThrow();

        fs.rmSync(path.join(root, 'src/platform/shelf'), { recursive: true });
        fs.rmSync(path.join(root, 'dist/src/platform/shelf'), { recursive: true });
        write(root, PROBE, kept.get(PROBE) ?? '');
        runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.build.json'] });
        rewriteAliases(root);
      },
      240_000,
    );
  },
);
