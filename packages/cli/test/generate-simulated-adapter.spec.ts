import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { hygieneRules } from '../src/depcruise/hygiene-rules';
import { cli, exists, read, tempDir } from './helpers';
import { failure } from './reports';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

const BILLING = 'src/contexts/billing';
const SIMULATED = `${BILLING}/infrastructure/external/simulated-payment-gateway.adapter.ts`;
const SPEC = `${BILLING}/test/integration/simulated-payment-gateway.adapter.spec.ts`;
const FAKE = `${BILLING}/test/fakes/payment-gateway.fake.ts`;
const MODULE = `${BILLING}/billing.module.ts`;

/** A project of the given stack with the billing context and its PaymentGateway port, and the result of the simulated adapter asked for it. */
function simulatedAdapter(...flags: readonly string[]): { root: string; result: ReturnType<typeof cli> } {
  const root = tempDir('simulated');

  expect(cli(root, 'init', ...flags).code).toBe(0);
  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
  expect(cli(root, 'generate', 'port', 'billing', 'PaymentGateway').code).toBe(0);

  return {
    root,
    result: cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--kind', 'simulated', '--json'),
  };
}

describe('the simulated adapter of a port', () => {
  it('answers in the memory of the process from infrastructure, declares itself for its port and carries no policy', () => {
    const { root, result } = simulatedAdapter();
    const adapter = read(root, SIMULATED);

    expect(result.code).toBe(0);
    expect(adapter).toContain("@Adapter(PaymentGateway, { kind: 'external' })");
    expect(adapter).toContain('export class SimulatedPaymentGateway implements PaymentGateway {');
    expect(adapter).toContain('answer through its translator of infrastructure/anti-corruption');
    expect(adapter).not.toMatch(/ownPolicy|retry|transport|test\/fakes/);

    expect(read(root, SPEC)).toContain(
      'expect(new SimulatedPaymentGateway()).toBeInstanceOf(SimulatedPaymentGateway);',
    );

    expect(exists(root, `${BILLING}/infrastructure/external/remote-payment-gateway.adapter.ts`)).toBe(false);
    expect(exists(root, 'src/platform/resilience/own-policy.ts')).toBe(false);
    expect(cli(root, 'check', '--json').json()).toMatchObject({ ok: true, violations: [] });
  });

  it('is bound in the module file of an explicit context on tsyringe, as an outside system with no policy of its own', () => {
    const { root, result } = simulatedAdapter('--style', 'explicit');
    const module = read(root, MODULE);

    expect(result.code).toBe(0);

    expect(module).toContain(
      "import { SimulatedPaymentGateway } from '@/contexts/billing/infrastructure/external/simulated-payment-gateway.adapter';",
    );

    expect(module).toContain("builder.bind(PaymentGateway).toClass(SimulatedPaymentGateway).as('external');");
    expect(read(root, SIMULATED)).not.toContain('@Adapter');
    expect(cli(root, 'check', '--json').json()).toMatchObject({ ok: true, violations: [] });
  });

  it.each([[['--di', 'manual']], [['--http', 'nest', '--validation', 'class-validator']]])(
    'is instantiated by hand where the context is wired by hand, as the note says (%j)',
    (flags) => {
      const { root, result } = simulatedAdapter(...flags);

      expect(result.code).toBe(0);

      expect(stringsAt(result.json(), 'notes')).toContain(
        "Instantiate SimulatedPaymentGateway in billing.module.ts and give it to the handlers that need it: platform.adapter(new SimulatedPaymentGateway(), { kind: 'external', context: 'billing' }).",
      );

      expect(read(root, SIMULATED)).not.toContain('@Adapter');
    },
  );

  it('takes the place of a binding already written, which the note names, without a second one', () => {
    const { root } = simulatedAdapter('--style', 'explicit');
    const remote = cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--json');

    expect(stringsAt(remote.json(), 'notes').join('\n')).toContain(
      "PaymentGateway is already bound in billing.module.ts: bind RemotePaymentGateway in its place when the outside system is ready, with .as('external').",
    );

    expect(read(root, MODULE).match(/\.bind\(PaymentGateway\)/g)).toHaveLength(1);
  });

  it('takes turns with the remote adapter in the declared style: one adapter per port, and the refusal says which one to remove', () => {
    const { root } = simulatedAdapter();
    const remote = cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--json');

    expect(remote.code).toBe(2);

    expect(failure(remote)).toEqual({
      message: 'PaymentGateway is already bound by infrastructure/external/simulated-payment-gateway.adapter.ts.',
      fix: 'A port has one adapter, and that one simulates the outside system. When the real system is ready, remove it and its spec, and run the command again.',
    });

    const other = tempDir('simulated');

    cli(other, 'init');
    cli(other, 'generate', 'context', 'billing', '--classification', 'core');
    cli(other, 'generate', 'port', 'billing', 'PaymentGateway');
    cli(other, 'generate', 'adapter', 'billing', 'PaymentGateway');

    const simulated = cli(other, 'generate', 'adapter', 'billing', 'PaymentGateway', '--kind', 'simulated', '--json');

    expect(simulated.code).toBe(2);

    expect(failure(simulated).fix).toBe(
      'A port has one adapter. To answer it in memory instead, remove that class and its spec, and run the command again.',
    );
  });

  it('refuses --decorators: nothing it does leaves the process, so it carries no policy', () => {
    const root = tempDir('simulated');

    cli(root, 'init');
    cli(root, 'generate', 'context', 'billing', '--classification', 'core');
    cli(root, 'generate', 'port', 'billing', 'PaymentGateway');

    const refused = cli(
      root,
      'generate',
      'adapter',
      'billing',
      'PaymentGateway',
      '--kind',
      'simulated',
      '--decorators',
      '--json',
    );

    expect(refused.code).toBe(2);
    expect(failure(refused).message).toBe('A simulated adapter carries no policy: nothing it does leaves the process.');
    expect(exists(root, SIMULATED)).toBe(false);
  });

  it('is production code that the import graph still forbids to reach a fake of the tests', () => {
    const { root } = simulatedAdapter();

    const rule = hygieneRules(parseConfig(readJson(root, 'ddd-ts-kit.config.json'))).find(
      (candidate) => candidate.name === 'not-to-test',
    );

    const matches = (patterns: unknown, file: string): boolean =>
      (Array.isArray(patterns) ? patterns : [patterns])
        .filter((pattern): pattern is string => typeof pattern === 'string')
        .some((pattern) => new RegExp(pattern).test(file));

    expect(matches(rule?.from['path'], SIMULATED)).toBe(true);
    expect(matches(rule?.from['pathNot'], SIMULATED)).toBe(false);
    expect(matches(rule?.to['path'], FAKE)).toBe(true);
  });
});
