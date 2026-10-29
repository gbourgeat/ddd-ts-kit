import { beforeAll, describe, expect, it } from 'vitest';
import { cli, EXPLICIT_STACK, read, scaffoldEverything, tempDir } from './helpers';

const UNIT = 'src/contexts/billing/test/unit';
const HANDLERS = 'src/contexts/billing/application/event-handlers';

let root: string;

beforeAll(() => {
  root = tempDir('event-handler-phase');
  scaffoldEverything(root);
});

describe('generate event-handler and the phase of the reaction', () => {
  it('writes a reaction before the commit by default, given the command bus, and a spec whose policy is pending beside what the fresh handler does', () => {
    const spec = read(root, `${UNIT}/invoice-issued.event-handler.spec.ts`);

    expect(read(root, `${HANDLERS}/invoice-issued.event-handler.ts`)).toContain(
      'constructor(private readonly commands: CommandBus) {}',
    );

    expect(spec).toContain("it.todo('carries out the policy that follows the fact');");
    expect(spec).toContain('TODO(domain): replace this test by the entries below once the policy is written');
    // One running test says what the fresh handler does, so that a generated project covers it as generated.
    expect(spec).toContain("it('handles the fact and sends no command until the policy is written', async () => {");
    expect(spec).toContain('await new InvoiceIssuedEventHandler(commands).handle(fact);');
    expect(spec).not.toContain('unitOfWorkStage');
  });

  it('writes a reaction once the unit of work has committed with --phase after-commit, left to the port it needs, and a pending spec', () => {
    const handler = read(root, `${HANDLERS}/invoice-marked-as-paid.event-handler.ts`);
    const spec = read(root, `${UNIT}/invoice-marked-as-paid.event-handler.spec.ts`);

    expect(handler).toContain("@DomainEventHandler(InvoiceMarkedAsPaid, { phase: 'after-commit' })");
    expect(handler).not.toContain('constructor(');
    expect(handler).not.toContain('private readonly commands');
    expect(spec).toContain("it.todo('carries out the effect that follows the commit of the fact');");
    expect(spec).toContain('the handler given the fake of its port and the fact');
    expect(spec).not.toContain('RecordingCommandBus()');
    expect(spec).toContain("it('handles the fact and has no effect until the effect is written', async () => {");

    expect(spec).toContain(
      'await expect(new InvoiceMarkedAsPaidEventHandler().handle(fact)).resolves.toBeUndefined();',
    );

    expect(spec).not.toContain('afterCommitFailures');
  });

  it('refuses a phase it does not know, and says which exist', () => {
    const result = cli(root, 'generate', 'event-handler', 'billing', 'Invoice', 'Cancelled', '--phase', 'later');

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Unknown phase "later".');
    expect(`${result.stdout}${result.stderr}`).toContain('--phase after-commit');
  });
});

describe('generate event-handler wired by a module file', () => {
  it('builds the reaction before the commit with the command bus, and the one after it with nothing yet', () => {
    const explicit = tempDir('event-handler-phase-explicit');

    scaffoldEverything(explicit, EXPLICIT_STACK);

    const module = read(explicit, 'src/contexts/billing/billing.module.ts');

    expect(module).toContain('.toClass(InvoiceIssuedEventHandler, [CommandBus])');
    expect(module).toContain('.toClass(InvoiceMarkedAsPaidEventHandler)');
  });
});
