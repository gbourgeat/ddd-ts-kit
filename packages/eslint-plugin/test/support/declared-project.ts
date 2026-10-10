import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { COMMAND, DECLARED, declaring, EVENT, QUERY } from './declared-style.js';
import { BILLING } from './rule-tester.js';

/** A project on disk, for what is read from the file a class is imported from. */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-declared-'));

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A source placed in the project on disk: what it imports is read from the files written below. */
export function inProject(
  file: string,
  code: string,
  config: Record<string, unknown> = DECLARED,
): { code: string; settings: Record<string, unknown> } {
  return { code, settings: { 'ddd-ts-kit': { config, filename: file, rootDir: root } } };
}

function onDisk(file: string, code: string): void {
  fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), code);
}

onDisk(
  COMMAND,
  declaring(
    'Requires',
    "@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}",
  ),
);

onDisk(QUERY, declaring('Public as Open', '@Open()\nexport class ListInvoicesQuery extends Query<Invoice[]> {}'));

onDisk(
  `${BILLING}/application/commands/void-invoice/void-invoice.command.ts`,
  'export class VoidInvoiceCommand extends AuthorizedCommand<void> {}',
);

onDisk(
  `${BILLING}/application/commands/pay-invoice/pay-invoice.command.ts`,
  "import { Requires } from './home-made.js';\n@Requires('x')\nexport class PayInvoiceCommand extends AuthorizedCommand<void> {}",
);

onDisk(EVENT, "export class InvoiceIssued extends DomainEvent { readonly name = 'billing.invoice.issued' as const; }");
onDisk(`${BILLING}/domain/events/broken.event.ts`, 'export class Broken {');
