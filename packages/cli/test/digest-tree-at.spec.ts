import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { treeAt } from '../src/digest/tree-at';
import { tempDir } from './helpers';
import { type Files, trunkRepository } from './support/trunk-history';

const CONTEXTS = { billing: { classification: 'core' } };

/** The tree of the only commit of a repository that holds `files`. */
function treeOf(files: Files): ReturnType<typeof treeAt> {
  return treeAt(trunkRepository(files), 'HEAD', path.join(tempDir('tree-at'), 'tree'));
}

describe('the tree of a commit, when a reader of its contexts fails', () => {
  it('describes no context and says why when a reader refuses: a controller under no alias', () => {
    const controller = [
      "import { Controller } from '@nestjs/common';",
      "import { KitRoutes } from '@ddd-ts-kit/http/nest';",
      '',
      "@Controller('invoices')",
      'export class InvoicesController {}',
      '',
    ].join('\n');

    const file = 'modules/billing/presentation/http/invoices.controller.ts';

    const tree = treeOf({
      'ddd-ts-kit.config.json': JSON.stringify({ contexts: CONTEXTS, contextsDir: 'modules' }),
      [file]: controller,
    });

    expect(tree).toMatchObject({ contexts: [], problem: `${file} is under no directory an import alias names` });
  });

  // A refusal once #681 is fixed.
  it('lets through what is no refusal: a config nested too deep for its refusal to be written', () => {
    const nested = `${'['.repeat(200_000)}${']'.repeat(200_000)}`;

    expect(() => treeOf({ 'ddd-ts-kit.config.json': `{"stack":{"orm":${nested}}}` })).toThrow(RangeError);
  });

  it('lets through what is no refusal: a schema written inline that a regular expression cannot hold', () => {
    const controller = [
      "@Controller({ method: 'POST', path: '/pay', body: z.object({ amount: z.number(), currency: z.string() }), })",
      'export class PayController {}',
      '',
    ].join('\n');

    expect(() =>
      treeOf({
        'ddd-ts-kit.config.json': JSON.stringify({ contexts: CONTEXTS }),
        'src/contexts/billing/presentation/http/pay.controller.ts': controller,
      }),
    ).toThrow(SyntaxError);
  });
});
