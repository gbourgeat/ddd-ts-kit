import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read, REPO_ROOT, scaffoldEverything, tempDir, write } from './helpers';
import { importGenerated } from './support/import-generated';
import { initProject } from './support/init-project';
import { sourceFiles } from './support/source-files';

const ISSUED = 'src/contexts/billing/published-language/invoice-issued.v1.integration-event.ts';
const JOINED = 'src/contexts/identity/published-language/member-joined.v1.integration-event.ts';
const META = { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' };
const COMMAND = 'src/contexts/billing/application/commands/refund-invoice/refund-invoice.command.ts';
const SPEC = 'src/contexts/billing/test/unit/refund-invoice.controller.spec.ts';

/** A refund as a team declares it once generated: the invoice in the path, the reason and the amount in the body. */
const REFUND = [
  "import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';",
  '',
  'export class RefundInvoiceCommand extends AuthorizedCommand {',
  '  constructor(actor: Actor, readonly invoiceId: string, readonly reason: string, readonly refundAmount: number) {',
  '    super(actor);',
  '  }',
  '}',
  '',
].join('\n');

/** A decorated field with an initial value: class-transformer keeps it for a field the input lacks. */
const INITIALIZED_FIELD = /^ {2}@[A-Z]\w*\(.*\)\n(?: {2}@[A-Z]\w*\(.*\)\n)* {2}(?:readonly )?\w+[?!]?(?::[^=\n]+)? = /m;

/** What a consumer reads of a published event: the parse of its definition. */
interface EventDefinition {
  parse(event: unknown): { readonly ok: boolean; readonly error?: unknown };
}

describe('the classes the generator writes for class-validator', () => {
  it('declare each decorated field without an initial value, so that a field the input lacks stays missing', () => {
    const root = tempDir('declared-fields');

    scaffoldEverything(root, { ...DEFAULT_STACK, validation: 'class-validator' });

    const decorated = sourceFiles(root, 'src').filter((file) => file.text.includes("from 'class-validator'"));

    expect(decorated.length).toBeGreaterThan(0);
    expect(decorated.filter((file) => INITIALIZED_FIELD.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it.each([
    ['the kit', ['--validation', 'class-validator']],
    ['Nest', ['--http', 'nest', '--di', 'nest', '--validation', 'class-validator', '--routes', 'nest']],
  ])(
    'write the spec of a route served by %s that sends its body without its first field and expects 422 naming it',
    (_server, flags) => {
      const spec = refundRouteIn(flags);

      expect(spec).toContain("it('refuses a body without `reason` with 422, naming the field', async () => {");
      expect(spec).toContain("params: { invoiceId: 'invoice-id-1' }, body: { refundAmount: 1 } }");
      expect(spec).toContain("body: { code: 'VALIDATION_FAILED', issues: [{ path: 'body.reason' }] },");
      expect(spec).toContain('expect(commands.executed).toEqual([]);');
    },
  );

  it('refuses the payload of a generated integration event that lacks its identifier, as its consumer reads it', async () => {
    const root = initProject('--context', 'billing:core', '--validation', 'class-validator');

    generate(root, 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=What a customer owes');
    generate(root, 'integration-event', 'billing', 'Invoice', 'Issued', '--term', 'Issue=To send an invoice');

    const issued = await definitionIn(root, ISSUED, 'invoiceIssuedV1');
    const event = { ...META, type: 'billing.invoice.issued', version: 1 };

    expect(issued.parse({ ...event, payload: {} })).toMatchObject({
      ok: false,
      error: { reason: 'invalid-payload', issues: [{ path: 'invoiceId' }] },
    });

    expect(issued.parse({ ...event, payload: { invoiceId: 'invoice-1' } })).toMatchObject({ ok: true });
  });

  it('refuses a payload of the identity preset that lacks the account it names, as its consumer reads it', async () => {
    const root = initProject('--validation', 'class-validator', '--preset', 'identity');
    const joined = await definitionIn(root, JOINED, 'memberJoinedV1');
    const event = { ...META, type: 'identity.member.joined', version: 1 };

    expect(
      joined.parse({ ...event, payload: { memberId: 'member-1', organisationId: 'acme', role: 'member' } }),
    ).toMatchObject({ ok: false, error: { reason: 'invalid-payload', issues: [{ path: 'accountId' }] } });
  });
});

/** The spec `generate route` writes once the command of the route declares its fields. */
function refundRouteIn(flags: readonly string[]): string {
  const root = initProject('--context', 'billing:core', ...flags);

  generate(root, 'command', 'billing', 'RefundInvoice', '--permission', 'invoice.refund', '--allow-name');
  write(root, COMMAND, REFUND);
  generate(root, 'route', 'billing', 'RefundInvoice', '--method', 'POST', '--path', '/invoices/:invoiceId/refund');

  return read(root, SPEC);
}

function generate(root: string, ...args: string[]): void {
  const result = cli(root, 'generate', ...args);

  expect(result.code, result.stderr).toBe(0);
}

/** The definition a generated file exports, loaded with the packages of the workspace, which the project has not installed. */
async function definitionIn(root: string, file: string, name: string): Promise<EventDefinition> {
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

  const loaded = (await importGenerated(root, file)) as Record<string, EventDefinition | undefined>;
  const definition = loaded[name];

  if (definition === undefined) {
    throw new Error(`${file} exports no ${name}.`);
  }

  return definition;
}
