import { tempDir, write } from '../helpers';

export const BILLING = 'src/contexts/billing';
const MODULES = { invoices: {}, reminders: {}, ledgers: {}, archives: {} };

export const INVOICE = 'invoices/domain/aggregates/invoice.aggregate.ts';
export const REMINDER = 'reminders/domain/aggregates/reminder.aggregate.ts';
export const DUNNING = 'domain/services/dunning.service.ts';

/** A source that imports the files named, relative to billing, by the alias of the project. */
function importing(...files: string[]): string {
  const imports = files.map((file, at) => `import { n${at} } from '@/contexts/billing/${file.replace(/\.ts$/, '')}';`);

  return [...imports, `export const n0 = ${files.length};`, ''].join('\n');
}

/** A project holding billing as `files` lay it out: each path relative to billing, with what it imports. */
export function billingWith(files: Readonly<Record<string, readonly string[]>>, rules: object = {}): string {
  const root = tempDir('move-to-module-cycles');
  const contexts = { billing: { classification: 'core', upstreams: [], modules: MODULES } };

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts, rules }));

  for (const [file, imported] of Object.entries(files)) {
    write(root, `${BILLING}/${file}`, importing(...imported));
  }

  return root;
}
