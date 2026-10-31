import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, REPO_ROOT, tempDir } from './helpers';

const page = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

/** Splits a command line the way a shell does for double and single quotes, enough for the lines of the pages. */
function words(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
}

/** The `generate error` and `generate domain-event` lines a page cites in backticks, wherever the prose wraps them. */
function citedGenerateLines(file: string): string[] {
  const text = page(file).replace(/\n(?!\n)/g, ' ');

  return [...text.matchAll(/`(generate (?:error|domain-event) [^`]+)`/g)].map((match) => match[1] ?? '');
}

describe('the pages of the guides, run as written on the project they follow', () => {
  describe('first-slice, on the project the README builds', () => {
    let root: string;

    beforeAll(() => {
      root = tempDir('guides-first-slice');
      expect(cli(root, 'init').code).toBe(0);

      const readme = page('README.md').replace(/ \\\n\s+/g, ' ');
      const start = readme.indexOf('pnpm exec ddd-ts-kit generate context ordering');

      const lines = readme
        .slice(start)
        .split('\n')
        .slice(0, 6)
        .map((line) => line.replace(/^(pnpm exec )?ddd-ts-kit /, ''));

      for (const line of lines) {
        const result = cli(root, ...words(line));

        expect(result.code, `${line} ${result.stderr}`).toBe(0);
      }
    });

    it('accepts every generate line the guide cites, after the lines of the README', () => {
      const cited = citedGenerateLines('docs/guides/first-slice.md');

      expect(cited).toHaveLength(2);

      for (const line of cited) {
        const result = cli(root, ...words(line));

        expect(result.code, `${line} ${result.stderr}`).toBe(0);
      }

      expect(read(root, 'src/contexts/ordering/domain/errors/order-empty.error.ts')).toContain('OrderEmpty');
    });

    it('cites the same lines on the French page', () => {
      expect(citedGenerateLines('docs/guides/first-slice.fr.md')).toEqual(
        citedGenerateLines('docs/guides/first-slice.md'),
      );
    });
  });

  describe('closing-the-loop, the outbox query', () => {
    it('names the table in the schema the generated project puts it in', () => {
      const schema = read(
        path.join(REPO_ROOT, 'packages/cli/templates/init/platform/database'),
        'schema.drizzle.ts.tpl',
      );

      const name = /MESSAGING_SCHEMA = '(\w+)'/.exec(schema)?.[1];

      expect(name).toBe('messaging');

      for (const file of ['docs/guides/closing-the-loop.md', 'docs/guides/closing-the-loop.fr.md']) {
        expect(page(file), file).toContain(`FROM ${name}.outbox WHERE status = 'pending'`);

        expect(page(file), file).toMatch(/`<sch[eé]ma>\.outbox`/);
      }
    });
  });
});
