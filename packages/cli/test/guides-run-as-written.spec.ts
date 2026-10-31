import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, REPO_ROOT } from './helpers';

const page = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

describe('the pages of the guides, run as written on the project they follow', () => {
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
