import path from 'node:path';
import { cli, read, tempDir, write } from '../helpers';
import { expectOk } from './expect-ok';
import { git } from './git';

/** The spec of the handler the slice generates, where a person writes the rules of the use case. */
export const HANDLER_SPEC = 'src/contexts/billing/test/unit/issue-invoice.handler.spec.ts';

/** The rule a person adds to the generated spec of the handler. */
export const WRITTEN_TITLE = 'issues the invoice to the customer it is addressed to';

/** Where the project stands in its repository, and the attributes its repository gives git. */
export interface SlicedProjectOptions {
  /** The project in a directory of the repository instead of at its top. */
  readonly below?: boolean;
  /** The `.gitattributes` the base commits at the top of the repository. */
  readonly attributes?: string;
}

/**
 * A project whose repository holds `main`, the bootstrap and the aggregate Invoice, then the branch
 * `slice/issue-invoice` cut from it with one slice committed: the command IssueInvoice granted to
 * the role accountant, its route, and a rule written in the spec of its handler.
 */
export function slicedProject({ below = false, attributes }: SlicedProjectOptions = {}): string {
  const top = tempDir('sliced');
  const root = below ? path.join(top, 'apps', 'invoicing') : top;

  expectOk(cli(root, 'init', '--context', 'billing:core'));
  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=what a customer owes'));

  if (attributes !== undefined) {
    write(top, '.gitattributes', attributes);
  }

  git(top, 'init', '--quiet', '--initial-branch', 'main');
  commit(top, 'feat(billing): the invoice');
  git(top, 'checkout', '--quiet', '-b', 'slice/issue-invoice');
  buildSlice(root);
  commit(top, 'feat(billing): issue an invoice');

  return root;
}

function buildSlice(root: string): void {
  expectOk(
    cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--permission',
      'invoice.issue',
      '--grant',
      'accountant',
      '--aggregate',
      'Invoice',
      '--term',
      'Issue=send an invoice to its customer',
    ),
  );

  expectOk(cli(root, 'generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices'));

  write(
    root,
    HANDLER_SPEC,
    `${read(root, HANDLER_SPEC)}\ndescribe('an issued invoice', () => {\n  it('${WRITTEN_TITLE}', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
  );
}

/** Commits everything the working tree holds, as the branch of a story does. */
export function commit(top: string, message: string): void {
  git(top, 'add', '--all');
  git(top, 'commit', '--quiet', '--message', message);
}
