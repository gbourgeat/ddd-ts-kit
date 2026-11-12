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
const CONFIG = 'src/platform/config/load-config.ts';
const PORT = 'src/contexts/billing/application/ports/model-reader.port.ts';
const SHIPPING = 'src/contexts/shipping';

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

  it('reports a gateway and an @Adapter that names no kind, external by default, and an own policy that is shorter', () => {
    const gateway = delegating('@Gateway(QuoteReader)');
    const unnamed = delegating('@Adapter(QuoteReader)');
    const shorter = delegating("@Adapter(QuoteReader, { kind: 'publisher', aspects: [ownPolicy(timeout(500))] })");
    const beside = delegating("@Adapter(QuoteReader, { kind: 'external', aspects: [timeout(500)] })");

    expect(reported(gateway, RULE)[0]?.message).toContain('the default policy of the gateway adapters');
    expect(reported(unnamed, RULE)[0]?.message).toContain('the default policy of the external adapters');
    expect(reported(shorter, RULE)[0]?.message).toContain('is cut after 500 ms (its own policy)');
    expect(reported(beside, RULE)[0]?.message).toContain('is cut after 500 ms (its own policy)');
  });

  it('accepts an own policy at least as long, ownPolicy() alone, and a kind the default policy leaves alone', () => {
    const cases = [
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy(timeout(120_000))] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy()] })",
      "@Adapter(QuoteReader, { kind: 'publisher' })",
    ];

    expect(cases.flatMap((decorator) => reported(delegating(decorator), RULE))).toEqual([]);
  });

  it('reads the @Timeout of the methods behind the port, the shortest of them, and never those of the adapter given the port', () => {
    const timedMethods = delegating(
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy()] })",
      '  @Timeout(500)',
      '  async send(): Promise<void> {}',
    );

    const behind = projectWith({
      [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: declared(
        "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy()] })",
        'RemoteModelReader',
        '  @Timeout(60_000, { signal: true })',
        '  async read(): Promise<void> {}',
        '  @Timeout(90_000)',
        '  async list(): Promise<void> {}',
      ),
      [SETTINGS]: DEFAULTS,
    });

    expect(reported(timedMethods, RULE)).toEqual([]);
    expect(reported(behind, RULE)[0]?.message).toContain('which RemoteModelReader serves with a limit of 60000 ms');
  });
});

describe(`${RULE}, what it reads and what it leaves`, () => {
  it('judges nothing it cannot read on the adapter given the port: a duration, a kind, an aspect under when(...)', () => {
    const cases = [
      "@Adapter(QuoteReader, { kind: 'external', aspects: [timeout(settings.quotesMs)] })",
      '@Adapter(QuoteReader, { kind: kindOf(environment) })',
      "@Adapter(QuoteReader, { kind: 'publisher', aspects: [when(forMethods('ping'), timeout(500))] })",
    ];

    expect(cases.flatMap((decorator) => reported(delegating(decorator), RULE))).toEqual([]);
  });

  it('judges nothing it cannot read behind the port: a duration, a @Timeout, a kind, an adapter that states no limit', () => {
    const behind = (decorator: string, ...members: string[]): string =>
      projectWith({
        [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
        [MODELS]: declared(decorator, 'RemoteModelReader', ...members),
        [SETTINGS]: DEFAULTS,
      });

    const roots = [
      behind('@Adapter(ModelReader, { aspects: [ownPolicy(timeout(limit))] })'),
      behind(
        '@Adapter(ModelReader, { aspects: [ownPolicy()] })',
        '  @Timeout(LIMIT)',
        '  async read(): Promise<void> {}',
      ),
      behind('@Adapter(ModelReader, { kind: kindOf(environment), aspects: [timeout(120_000)] })'),
      behind("@Adapter(ModelReader, { kind: 'external' })"),
    ];

    expect(roots.flatMap((root) => reported(root, RULE))).toEqual([]);
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

  it('takes the default limit from the fallback of OUTBOUND_TIMEOUT_MS in the platform, which main.ts runs with', () => {
    const configured = (fallback: string, settings = DEFAULTS): string =>
      projectWith({
        [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
        [MODELS]: declared(SLOW, 'RemoteModelReader'),
        [SETTINGS]: settings,
        [CONFIG]: `export const resilience = { timeoutMs: env.integer('OUTBOUND_TIMEOUT_MS', ${fallback}) };\n`,
      });

    expect(reported(configured('{ fallback: 150_000, min: 1 }'), RULE)).toEqual([]);
    expect(reported(configured('{ min: 1, fallback: 30_000 }'), RULE)[0]?.message).toContain('is cut after 30000 ms');
    expect(reported(configured('{ fallback: 2 * SECOND }'), RULE)).toEqual([]);
    expect(reported(configured('{ min: 1 }'), RULE)).toEqual([]);
  });

  it('judges no default it cannot read: settings that are not one number, a project without them', () => {
    const withSettings = (settings: Record<string, string>): string =>
      projectWith({
        [QUOTES]: declared("@Adapter(QuoteReader, { kind: 'external' })", 'RemoteQuoteReader', GIVEN_THE_MODELS),
        [MODELS]: declared(SLOW, 'RemoteModelReader'),
        ...settings,
      });

    const roots = [
      withSettings({ [SETTINGS]: 'export const defaultResilienceSettings = settingsOf(environment);\n' }),
      withSettings({ [SETTINGS]: 'export const defaultResilienceSettings = { timeoutMs: 2 * 1000 };\n' }),
      withSettings({}),
    ];

    expect(roots.flatMap((root) => reported(root, RULE))).toEqual([]);
  });
});

describe(`${RULE}, where it finds a port and a class`, () => {
  it('tells two ports of one name apart by the file each adapter imports its port from', () => {
    const imported = (from: string, decorator: string, name: string, ...members: string[]): string =>
      `import { ModelReader } from '${from}';\n${declared(decorator, name, ...members)}`;

    const quotes = imported(
      '../../application/ports/model-reader.port',
      "@Adapter(QuoteReader, { kind: 'external' })",
      'RemoteQuoteReader',
      GIVEN_THE_MODELS,
    );

    const ports = {
      [PORT]: 'export abstract class ModelReader {}\n',
      [`${SHIPPING}/application/ports/model-reader.port.ts`]: 'export abstract class ModelReader {}\n',
      [`${SHIPPING}/application/index.ts`]: "export { ModelReader } from './ports/model-reader.port';\n",
      [SETTINGS]: DEFAULTS,
    };

    const servedBy = (from: string): string =>
      projectWith({
        ...ports,
        [QUOTES]: quotes,
        [`${SHIPPING}/infrastructure/external/remote-model-reader.adapter.ts`]: imported(
          from,
          SLOW,
          'RemoteModelReader',
        ),
      });

    const sameContext = projectWith({
      ...ports,
      [QUOTES]: quotes,
      [MODELS]: imported('../../application/ports/model-reader.port', SLOW, 'RemoteModelReader'),
    });

    const declaredBesideItsAdapter = projectWith({
      ...ports,
      [QUOTES]: quotes,
      [`${SHIPPING}/infrastructure/external/remote-model-reader.adapter.ts`]: `export abstract class ModelReader {}\n${declared(SLOW, 'RemoteModelReader')}`,
    });

    expect(reported(servedBy('../../application/ports/model-reader.port'), RULE)).toEqual([]);
    expect(reported(declaredBesideItsAdapter, RULE)).toEqual([]);
    expect(reported(servedBy('../../application'), RULE).map(({ file }) => file)).toEqual([QUOTES]);
    expect(reported(sameContext, RULE).map(({ file }) => file)).toEqual([QUOTES]);
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
        '  builder.bind(Archive).toClass(RemoteArchive);',
        '}',
      ),
      [`${EXTERNAL}/remote-ledger.adapter.ts`]:
        'export class RemoteLedger {\n  constructor(private readonly models: ModelReader) {}\n}\n',
      [`${EXTERNAL}/remote-archive.adapter.ts`]:
        'export class RemoteArchive {\n  constructor(private readonly models: ModelReader) {}\n}\n',
    });

    expect(reported(root, RULE).map(({ file, line }) => [file, line])).toEqual([[QUOTES, 1]]);
  });

  it('finds a class two files declare by the import of the file that binds it, and leaves it without one', () => {
    const slow = 'export class RemoteModelReader {}\n';
    const given = 'export class RemoteQuoteReader {\n  constructor(private readonly models: ModelReader) {}\n}\n';
    const silent = 'export class RemoteQuoteReader {}\n';

    const bound = (importOfTheClass: string): string =>
      projectWith({
        [QUOTES]: given,
        [`${SHIPPING}/infrastructure/external/remote-quote-reader.adapter.ts`]: silent,
        [MODELS]: slow,
        [SETTINGS]: DEFAULTS,
        [MODULE]: lines(
          "import type { ContainerBuilder } from '@ddd-ts-kit/di';",
          importOfTheClass,
          'export function billingModule(builder: ContainerBuilder): void {',
          "  builder.bind(QuoteReader).toClass(RemoteQuoteReader).as('external');",
          "  builder.bind(ModelReader).toClass(RemoteModelReader).as('external').with(ownPolicy(timeout(120_000)));",
          '}',
        ),
      });

    const imported = bound(
      "import { RemoteQuoteReader } from './infrastructure/external/remote-quote-reader.adapter';",
    );

    expect(reported(imported, RULE).map(({ file }) => file)).toEqual([QUOTES]);
    expect(reported(bound(''), RULE)).toEqual([]);
  });
});
