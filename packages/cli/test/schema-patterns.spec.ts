import { describe, expect, it } from 'vitest';
import { CONFIG_FILE } from '../src/config/index.js';
import { config } from '../src/check/fixtures/config.js';
import { PATHS } from '../src/check/fixtures/paths.js';
import { project } from '../src/check/fixtures/project.js';
import { tempDir, write } from './helpers.js';
import { reported } from './rules-support.js';

const HTTP = `${PATHS.BILLING}/presentation/http/invoices`;
const ISSUE = `${HTTP}/issue-invoice/issue-invoice.controller.ts`;
const AMEND = `${HTTP}/amend-invoice/amend-invoice.controller.ts`;

function controller(body: string): string {
  return [
    "import { z } from 'zod';",
    "import { zodSchema } from '@ddd-ts-kit/validation/zod';",
    '',
    `export const body = zodSchema(${body});`,
    '',
  ].join('\n');
}

function duplicatesOf(amend: string, issue: string): string[] {
  const root = tempDir('schema-patterns');

  const files = project(
    { [AMEND]: controller(amend), [ISSUE]: controller(issue) },
    {
      [CONFIG_FILE]: config({ stack: { schemas: 'shared' } }),
    },
  );

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  return reported(root, 'schema/no-duplicate-shape').map(({ file }) => file);
}

describe('schema/no-duplicate-shape on the patterns of a schema', () => {
  it('tells two schemas apart by the regular expression an entry must match', () => {
    const upper = "z.object({ code: z.string().regex(/^[A-Z]{3}$/), label: z.string().describe('a / b') })";
    const lower = "z.object({ code: z.string().regex(/^[a-z]{3}$/), label: z.string().describe('a / b') })";

    expect(duplicatesOf(upper, lower)).toEqual([]);
  });

  it('reports two schemas whose entries match the same regular expression', () => {
    const upper = 'z.object({ code: z.string().regex(/^[A-Z]{3}$/) })';

    expect(duplicatesOf(upper, upper)).toEqual([ISSUE]);
  });
});
