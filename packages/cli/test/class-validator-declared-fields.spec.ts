import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read, REPO_ROOT, scaffoldEverything, tempDir, write } from './helpers';
import { scan } from '../src/check/scan/scan';
import { classStatements } from '../src/check/structure/class-statements';
import { readStructure } from '../src/check/structure/read-structure';
import { importAliased } from './support/import-aliased';
import { importGenerated } from './support/import-generated';
import { initProject } from './support/init-project';
import { type SourceFile, sourceFiles } from './support/source-files';

const ISSUED = 'src/contexts/billing/published-language/invoice-issued.v1.integration-event.ts';
const JOINED = 'src/contexts/identity/published-language/member-joined.v1.integration-event.ts';
const META = { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' };
const COMMAND = 'src/contexts/billing/application/commands/refund-invoice/refund-invoice.command.ts';
const SPEC = 'src/contexts/billing/test/unit/refund-invoice.controller.spec.ts';
const BODY = 'src/contexts/billing/presentation/http/invoices/refund-invoice/refund-invoice.body.ts';
const PROBE = 'src/refund-without-reason.ts';

/** The files that may hold a DTO class: those that import its decorators. */
const DECORATED = /from 'class-(?:validator|transformer)'/;

/** The request the generated refusal sends, through the route the kit serves, its answer exported. */
const SENT_WITHOUT_REASON = [
  "import { routeOf } from '@ddd-ts-kit/http/testing';",
  "import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';",
  "import { RefundInvoiceController } from '@/contexts/billing/presentation/http/invoices/refund-invoice/refund-invoice.controller';",
  '',
  'export const commands = new RecordingCommandBus();',
  "export const answer = routeOf(new RefundInvoiceController(commands)).send({ params: { invoiceId: 'invoice-1' }, body: { refundAmount: 1 } });",
  '',
].join('\n');

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

/** What a consumer reads of a published event: the parse of its definition. */
interface EventDefinition {
  parse(event: unknown): { readonly ok: boolean; readonly error?: unknown };
}

describe('the classes the generator writes for class-validator', () => {
  it.each([
    ['the kit', { ...DEFAULT_STACK, validation: 'class-validator' }],
    ['Nest', { ...DEFAULT_STACK, http: 'nest', di: 'nest', validation: 'class-validator' }],
  ])(
    'declare each field of a class of %s with decorators without an initial value, so that a field the input lacks stays missing',
    (_server, stack) => {
      const root = tempDir('declared-fields');

      scaffoldEverything(root, stack);

      const decorated = sourceFiles(root, 'src').filter((file) => DECORATED.test(file.text));

      expect(decorated.length).toBeGreaterThan(0);
      expect(decorated.flatMap(initializedFieldsOf)).toEqual([]);
    },
  );

  it.each([
    ['the kit', ['--validation', 'class-validator']],
    ['Nest', ['--http', 'nest', '--di', 'nest', '--validation', 'class-validator', '--routes', 'nest']],
  ])(
    'write the spec of a route served by %s that sends its body without its first field and expects 422 naming it',
    (_server, flags) => {
      const spec = refundRouteIn(flags);

      expect(spec).toContain("it('refuses a body without `reason` with 422, naming the field', async () => {");
      expect(spec).toContain("params: { invoiceId: 'invoice-id-1' }, body: { refundAmount: 1 } }");
      expect(spec).toContain("issues: expect.arrayContaining([expect.objectContaining({ path: 'body.reason' })]),");
      expect(spec).toContain('expect(commands.executed).toEqual([]);');
    },
  );

  it('refuses the body of a generated route that lacks a field of two constraints, the field among the issues the spec reads', async () => {
    const root = refundRouteRoot(['--validation', 'class-validator']);
    const body = read(root, BODY);

    write(
      root,
      BODY,
      body
        .replace('{ IsNumber, IsString }', '{ IsNotEmpty, IsNumber, IsString }')
        .replace('  @IsString()\n  declare reason', '  @IsString()\n  @IsNotEmpty()\n  declare reason'),
    );

    write(root, PROBE, SENT_WITHOUT_REASON);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

    const { answer, commands } = (await importAliased(root, PROBE)) as {
      answer: Promise<{ readonly body: { readonly issues: readonly unknown[] } }>;
      commands: { readonly executed: readonly unknown[] };
    };

    const answered = await answer;

    expect(answered).toMatchObject({
      status: 422,
      body: {
        code: 'VALIDATION_FAILED',
        issues: expect.arrayContaining([expect.objectContaining({ path: 'body.reason' })]),
      },
    });

    expect(answered.body.issues).toHaveLength(2);
    expect(commands.executed).toEqual([]);
  });

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

/** Each decorated class property given an initial value, read with the member parser of the checker. */
function initializedFieldsOf(file: SourceFile): string[] {
  const scanned = scan(file.text);

  return readStructure(scanned).classes.flatMap((shape) => {
    const properties = classStatements(shape, scanned.code).flatMap((property) =>
      property === undefined ? [] : [property],
    );

    return properties.some((property) => property.decorators.length > 0)
      ? properties
          .filter((property) => property.initialized)
          .map((property) => `${file.path}: ${shape.name}.${property.name}`)
      : [];
  });
}

/** The spec `generate route` writes once the command of the route declares its fields. */
function refundRouteIn(flags: readonly string[]): string {
  return read(refundRouteRoot(flags), SPEC);
}

/** A project whose refund command declares its fields, and the route generated after it. */
function refundRouteRoot(flags: readonly string[]): string {
  const root = initProject('--context', 'billing:core', ...flags);

  generate(root, 'command', 'billing', 'RefundInvoice', '--permission', 'invoice.refund', '--allow-name');
  write(root, COMMAND, REFUND);
  generate(root, 'route', 'billing', 'RefundInvoice', '--method', 'POST', '--path', '/invoices/:invoiceId/refund');

  return root;
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
