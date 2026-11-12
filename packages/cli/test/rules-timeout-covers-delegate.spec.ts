import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check';
import { loadProject } from '../src/check/project/load-project';
import { lines, projectWith, reported } from './rules-support';

const RULE = 'aspects/timeout-covers-delegate';
const EXTERNAL = 'src/contexts/billing/infrastructure/external';
const QUOTES = `${EXTERNAL}/remote-quote-reader.adapter.ts`;
const MODELS = `${EXTERNAL}/remote-model-reader.adapter.ts`;
const MODULE = 'src/contexts/billing/billing.module.ts';
const SETTINGS = 'src/platform/resilience/default-resilience-settings.ts';

const DEFAULTS =
  'export const defaultResilienceSettings = { retryAttempts: 3, retryBaseDelayMs: 100, timeoutMs: 2_000 };\n';

const SLOW =
  "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy(retry({ attempts: 2 }), timeout(120_000))] })";

/** A role file of the declared style: the decorator given, above a class whose body is `members`. */
function declared(decorator: string, name: string, ...members: string[]): string {
  return lines(
    "import { Adapter, Gateway } from '@ddd-ts-kit/kernel/declarations';",
    "import { Timeout } from '@ddd-ts-kit/aspects/decorators';",
    '',
    decorator,
    `export class ${name} {`,
    ...members,
    '}',
  );
}

const GIVEN_THE_MODELS = '  constructor(private readonly models: ModelReader) {}';

/** The quote reader under `decorator`, the slow model reader behind the port it is given, and the default settings. */
function delegating(decorator: string, ...members: string[]): string {
  return projectWith({
    [QUOTES]: declared(decorator, 'RemoteQuoteReader', GIVEN_THE_MODELS, ...members),
    [MODELS]: declared(SLOW, 'RemoteModelReader'),
    [SETTINGS]: DEFAULTS,
  });
}

describe(RULE, () => {
  it('reports an external adapter left to the default policy and given a port whose adapter states a longer limit', () => {
    const root = delegating("@Adapter(QuoteReader, { kind: 'external' })");

    expect(reported(root, RULE)).toEqual([
      {
        file: QUOTES,
        line: 5,
        message:
          'RemoteQuoteReader is cut after 2000 ms (the default policy of the external adapters, which it never chose) and is given ModelReader, which RemoteModelReader serves with a limit of 120000 ms: a call RemoteModelReader would still answer fails in RemoteQuoteReader first, as a timeout of RemoteQuoteReader.',
      },
    ]);

    expect(runCheck(loadProject(root), { rules: [RULE] }).violations[0]).toMatchObject({
      severity: 'error',
      fix: 'State the policy of RemoteQuoteReader where it is declared or bound, at least as long as the adapter it calls: `ownPolicy(timeout(120000))`; or `ownPolicy()` alone when it only hands the call over, RemoteModelReader carrying the policy.',
    });
  });

  it('reports a gateway under the default policy, and an own policy shorter than the adapter it calls', () => {
    const gateway = delegating('@Gateway(QuoteReader)');
    const shorter = delegating("@Adapter(QuoteReader, { kind: 'simulated', aspects: [ownPolicy(timeout(500))] })");

    expect(reported(gateway, RULE)[0]?.message).toContain('the default policy of the gateway adapters');
    expect(reported(shorter, RULE)[0]?.message).toContain('is cut after 500 ms (its own policy)');
  });

  it('accepts an own policy at least as long, ownPolicy() alone, and a kind the default policy leaves alone', () => {
    const cases = [
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy(timeout(120_000))] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy()] })",
      "@Adapter(QuoteReader, { kind: 'simulated' })",
      '@Adapter(QuoteReader)',
    ];

    expect(cases.flatMap((decorator) => reported(delegating(decorator), RULE))).toEqual([]);
  });

  it('reads the @Timeout of the methods: the longest of the delegating adapter against the shortest behind the port', () => {
    const own = "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy()] })";

    const short = delegating(
      own,
      '  @Timeout(500)',
      '  async read(): Promise<void> {}',
      '  @Timeout(900)',
      '  async list(): Promise<void> {}',
    );

    const long = delegating(
      own,
      '  @Timeout(500)',
      '  async read(): Promise<void> {}',
      '  @Timeout(120_000)',
      '  async list(): Promise<void> {}',
    );

    const behind = projectWith({
      [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: declared(
        "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy()] })",
        'RemoteModelReader',
        '  @Timeout(60_000)',
        '  async read(): Promise<void> {}',
      ),
      [SETTINGS]: DEFAULTS,
    });

    expect(reported(short, RULE)[0]?.message).toContain('is cut after 900 ms (the longest `@Timeout` of its methods)');
    expect(reported(long, RULE)).toEqual([]);
    expect(reported(behind, RULE)[0]?.message).toContain('which RemoteModelReader serves with a limit of 60000 ms');
  });
});

describe(`${RULE}, what it reads and what it leaves`, () => {
  it('judges nothing it cannot read: a duration that is not a number, an adapter behind the port that states none, no default settings', () => {
    const fromSettings = delegating(
      "@Adapter(QuoteReader, { kind: 'external', aspects: [timeout(settings.quotesMs)] })",
    );

    const unreadableBehind = projectWith({
      [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: declared('@Adapter(ModelReader, { aspects: [ownPolicy(timeout(limit))] })', 'RemoteModelReader'),
      [SETTINGS]: DEFAULTS,
    });

    const silentBehind = projectWith({
      [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: declared("@Adapter(ModelReader, { kind: 'external' })", 'RemoteModelReader'),
      [SETTINGS]: DEFAULTS,
    });

    const withoutDefaults = projectWith({
      [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: declared(SLOW, 'RemoteModelReader'),
      [SETTINGS]: 'export const defaultResilienceSettings = settingsOf(environment);\n',
    });

    const withoutPlatform = projectWith({
      [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: declared(SLOW, 'RemoteModelReader'),
    });

    expect(
      [fromSettings, unreadableBehind, silentBehind, withoutDefaults, withoutPlatform].flatMap((root) =>
        reported(root, RULE),
      ),
    ).toEqual([]);
  });

  it('counts the default policy around an adapter behind the port that states a limit without ownPolicy', () => {
    const root = projectWith({
      [QUOTES]: declared(
        "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy(timeout(1_000))] })",
        'RemoteQuoteReader',
        GIVEN_THE_MODELS,
      ),
      [MODELS]: declared(
        "@Adapter(ModelReader, { kind: 'external', aspects: [timeout(120_000)] })",
        'RemoteModelReader',
      ),
      [SETTINGS]: DEFAULTS,
    });

    expect(reported(root, RULE)[0]?.message).toContain('which RemoteModelReader serves with a limit of 2000 ms');
  });

  it('reads the bindings of a module file, once for a class bound twice, and leaves a class it cannot find', () => {
    const root = projectWith({
      [QUOTES]:
        'export class RemoteQuoteReader {\n  constructor(private readonly models: ModelReader, retries = 3) {}\n}\n',
      [MODELS]: 'export class RemoteModelReader {}\n',
      [SETTINGS]: DEFAULTS,
      [MODULE]: lines(
        "import type { ContainerBuilder } from '@ddd-ts-kit/di';",
        'export function billingModule(builder: ContainerBuilder): void {',
        "  builder.bind(QuoteReader).toClass(RemoteQuoteReader).as('external');",
        "  builder.rebind(QuoteReader).toClass(RemoteQuoteReader).as('external');",
        "  builder.bind(QuoteReader).toClass(RemoteQuoteReader).as('external');",
        "  builder.bind(ModelReader).toClass(RemoteModelReader).as('external').with(ownPolicy(timeout(120_000)));",
        '  builder.bind(Clock).toValue(clock);',
        "  builder.bind(PriceCatalog).toClass(RemotePriceCatalog).as('external');",
        '  builder.bind(Ledger).toClass(RemoteLedger).as(kindOf(environment));',
        '}',
      ),
      [`${EXTERNAL}/remote-ledger.adapter.ts`]:
        'export class RemoteLedger {\n  constructor(private readonly models: ModelReader) {}\n}\n',
    });

    expect(reported(root, RULE).map(({ file, line }) => [file, line])).toEqual([[QUOTES, 1]]);
  });
});
