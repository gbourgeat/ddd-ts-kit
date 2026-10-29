import { parseConfig } from '../../src/config';
import { describeOnDisk } from '../../src/docs/describe-on-disk';
import { readContexts } from '../../src/docs/read-contexts';
import { writeBehaviour } from '../../src/docs/write-behaviour';
import { Workspace } from '../../src/workspace';
import { tempDir, write } from '../helpers';

const BILLING = 'src/contexts/billing';

/** A spec file whose titles are given, under one `describe`, `it.todo` for a title that ends with ` (planned)`. */
export function specOf(subject: string, titles: readonly string[]): string {
  const calls = titles.map((title) =>
    title.endsWith(' (planned)')
      ? `  it.todo('${title.slice(0, -' (planned)'.length)}');`
      : `  it('${title}', () => {});`,
  );

  return `import { describe, it } from 'vitest';\n\ndescribe('${subject}', () => {\n${calls.join('\n')}\n});\n`;
}

/**
 * Billing as `describe` reads it, without running a generator: the command CancelInvoice with
 * its permission, the policy that decides that permission under another name, and the function
 * route that sends it; then the specs of `files`, written under the root of the project.
 */
export function behaviourProject(files: Readonly<Record<string, string>>): string {
  const root = tempDir('behaviour-page');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: { billing: { classification: 'core' } } }));
  write(root, `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`, 'export class X {}\n');

  write(
    root,
    `${BILLING}/billing.module.ts`,
    "builder.command(CancelInvoiceCommand).requires(billingPermissions['invoice.cancel']).handledBy(CancelInvoiceHandler);\n",
  );

  write(
    root,
    `${BILLING}/application/authorization/late-cancellation.policy.ts`,
    "export const rule = billingPermissions['invoice.cancel'];\n",
  );

  write(
    root,
    `${BILLING}/presentation/http/withdraw-invoice.route.ts`,
    "export const route = defineRoute({ method: 'DELETE', path: '/invoices/:id', operationId: 'cancelInvoice', handle: () => new CancelInvoiceCommand() });\n",
  );

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  return root;
}

/** The pages of what the tests state, as `docs` writes them for the project. */
export function behaviourPages(root: string): (page: string) => string {
  const config = parseConfig(JSON.parse(`{ "contexts": { "billing": { "classification": "core" } } }`));
  const ws = new Workspace(root, false);

  writeBehaviour(ws, config, describeOnDisk(ws, config, readContexts(ws, config)));

  return (page) => ws.read(`docs/behaviour/${page}.md`) ?? '';
}
