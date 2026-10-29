import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, scaffoldEverything, tempDir } from './helpers';

const UNIT = 'src/contexts/billing/test/unit';
const HANDLERS = 'src/contexts/billing/application/event-handlers';

let root: string;

beforeAll(() => {
  root = tempDir('event-handler-phase');
  scaffoldEverything(root);
});

describe('generate event-handler and the phase of the reaction', () => {
  it('writes a reaction before the commit by default, given the command bus, and a spec that gives it the fact and asserts the command it records', () => {
    const spec = read(root, `${UNIT}/invoice-issued.event-handler.spec.ts`);

    expect(read(root, `${HANDLERS}/invoice-issued.event-handler.ts`)).toContain(
      'constructor(private readonly commands: CommandBus) {}',
    );

    expect(spec).toContain("import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';");
    expect(spec).toContain("it('carries out the policy that follows the fact', async () => {");
    expect(spec).toContain('await new InvoiceIssuedEventHandler(commands).handle(fact);');
    expect(spec).toContain('expect(commands.executed).toEqual([]);');
    expect(spec).not.toContain('unitOfWorkStage');
  });

  it('writes a reaction once the unit of work has committed with --phase after-commit, and a spec of the same shape', () => {
    const spec = read(root, `${UNIT}/invoice-marked-as-paid.event-handler.spec.ts`);

    expect(read(root, `${HANDLERS}/invoice-marked-as-paid.event-handler.ts`)).toContain(
      "@DomainEventHandler(InvoiceMarkedAsPaid, { phase: 'after-commit' })",
    );

    expect(spec).toContain("it('carries out the effect that follows the commit of the fact', async () => {");
    expect(spec).toContain('await new InvoiceMarkedAsPaidEventHandler(commands).handle(fact);');
    expect(spec).toContain('an effect through a port hands the handler the fake of the port');
    expect(spec).not.toContain('afterCommitFailures');
  });

  it('refuses a phase it does not know, and says which exist', () => {
    const result = cli(root, 'generate', 'event-handler', 'billing', 'Invoice', 'Cancelled', '--phase', 'later');

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Unknown phase "later".');
    expect(`${result.stdout}${result.stderr}`).toContain('--phase after-commit');
  });
});
