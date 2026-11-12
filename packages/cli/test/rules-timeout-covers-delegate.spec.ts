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

const DEFAULTED = "@Adapter(QuoteReader, { kind: 'external' })";

const SLOW =
  "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy(retry({ attempts: 2 }), timeout(120_000))] })";

const GIVEN_THE_MODELS = '  constructor(private readonly models: ModelReader) {}';
const GIVEN = `import { ModelReader } from '../../application/ports/model-reader.port';\nexport class RemoteQuoteReader {\n  constructor(private readonly models: ModelReader) {}\n}\n`;

const SLOW_BOUND =
  "  builder.bind(ModelReader).toClass(RemoteModelReader).as('external').with(ownPolicy(timeout(120_000)));";

const DIRECT = '../../application/ports/model-reader.port';
const A_PORT = 'export abstract class ModelReader {}\n';

/** A project that declares the port the two adapters name, and the files given. */
function project(files: Readonly<Record<string, string>>): string {
  return projectWith({ [PORT]: A_PORT, ...files });
}

/**
 * A role file of the declared style: the decorator given, above a class whose body is `members`.
 * It imports the port from `port`, the file that declares it unless said otherwise, or from nowhere.
 */
function declaredFrom(port: string | undefined, decorator: string, name: string, ...members: string[]): string {
  return lines(
    "import { Adapter, Gateway } from '@ddd-ts-kit/kernel/declarations';",
    "import { Timeout } from '@ddd-ts-kit/aspects/decorators';",
    ...(port === undefined ? [] : [`import { ModelReader } from '${port}';`]),
    '',
    decorator,
    `export class ${name} {`,
    ...members,
    '}',
  );
}

function declared(decorator: string, name: string, ...members: string[]): string {
  return declaredFrom(DIRECT, decorator, name, ...members);
}

/** The quote reader under `outer`, given the port of the model reader, which is declared under `inner`. */
function delegating(outer: string, inner = SLOW, ...membersOfTheInner: string[]): string {
  return project({
    [QUOTES]: declared(outer, 'RemoteQuoteReader', GIVEN_THE_MODELS),
    [MODELS]: declared(inner, 'RemoteModelReader', ...membersOfTheInner),
    [SETTINGS]: DEFAULTS,
  });
}

/** The two adapters as plain classes, bound by the statements given in the module file of the context. */
function bound(...statements: string[]): string {
  return project({
    [QUOTES]: GIVEN,
    [MODELS]: 'export class RemoteModelReader {}\n',
    [SETTINGS]: DEFAULTS,
    [MODULE]: lines(
      "import type { ContainerBuilder } from '@ddd-ts-kit/di';",
      'export function billingModule(builder: ContainerBuilder): void {',
      ...statements,
      '}',
    ),
  });
}

const DEFAULTED_BOUND = "  builder.bind(QuoteReader).toClass(RemoteQuoteReader).as('external');";

describe(RULE, () => {
  it('reports an adapter left to the default policy and given a port whose adapter states a longer limit', () => {
    const root = delegating(DEFAULTED);

    expect(reported(root, RULE)).toEqual([
      {
        file: QUOTES,
        line: 6,
        message:
          'RemoteQuoteReader is left to the default policy of the platform, which cuts each attempt after 2000 ms, and is given ModelReader, which RemoteModelReader serves with a limit of 120000 ms: a call RemoteModelReader would still answer fails in RemoteQuoteReader first, as a timeout of RemoteQuoteReader.',
      },
    ]);

    expect(runCheck(loadProject(root), { rules: [RULE] }).violations[0]).toMatchObject({
      severity: 'error',
      fix: 'State the policy of RemoteQuoteReader where it is declared or bound: `ownPolicy(timeout(120000))`, or any limit it chooses; or `ownPolicy()` alone when it only hands the call over, RemoteModelReader carrying the policy.',
    });
  });

  it('reports a gateway, an @Adapter that names no kind, a binding of the container, and reads the shortest limit behind the port', () => {
    const outside =
      "@Adapter(ModelReader, { kind: 'publisher', aspects: [timeout(90_000), timeout(60_000, { signal: true })] })";

    expect(reported(delegating('@Gateway(QuoteReader)'), RULE)).toHaveLength(1);
    expect(reported(delegating('@Adapter(QuoteReader)'), RULE)).toHaveLength(1);
    expect(reported(delegating('@Adapter(QuoteReader, [ModelReader])'), RULE)).toHaveLength(1);
    expect(reported(delegating(DEFAULTED, outside), RULE)[0]?.message).toContain('with a limit of 60000 ms');

    expect(reported(bound(DEFAULTED_BOUND, SLOW_BOUND), RULE).map(({ file, line }) => [file, line])).toEqual([
      [QUOTES, 2],
    ]);
  });

  it('accepts an adapter that states its own policy, even a shorter limit: it chose it', () => {
    const cases = [
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy(retry({ attempts: 3 }), timeout(2_000))] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy(timeout(500))] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [timeout(500)] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [ownPolicy()] })",
    ];

    expect(cases.flatMap((decorator) => reported(delegating(decorator), RULE))).toEqual([]);

    expect(reported(bound(`${DEFAULTED_BOUND.slice(0, -1)}.with(ownPolicy(timeout(500)));`, SLOW_BOUND), RULE)).toEqual(
      [],
    );
  });

  it('accepts a kind the default policy leaves alone, and a binding that names none', () => {
    expect(reported(delegating("@Adapter(QuoteReader, { kind: 'publisher' })"), RULE)).toEqual([]);
    expect(reported(bound('  builder.bind(QuoteReader).toClass(RemoteQuoteReader);', SLOW_BOUND), RULE)).toEqual([]);
  });
});

describe(`${RULE}, the limit behind the port`, () => {
  it('counts no @Timeout of a method behind the port: the text does not say which method is called', () => {
    const root = delegating(
      DEFAULTED,
      "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy()] })",
      '  @Timeout(120_000)',
      '  async read(): Promise<void> {}',
    );

    expect(reported(root, RULE)).toEqual([]);
  });

  it('counts a timeout( only as an element of the aspects or an argument of ownPolicy, never one nested in another call', () => {
    const nestedBehind = '@Adapter(ModelReader, { aspects: [ownPolicy(cached({ ttlMs: timeout(900_000) }))] })';
    const nestedInFront = '@Adapter(QuoteReader, { aspects: [cached({ key, ttlMs: timeout(3) })] })';

    expect(reported(delegating(DEFAULTED, nestedBehind), RULE)).toEqual([]);
    expect(reported(delegating(nestedInFront), RULE)[0]?.message).toContain('cuts each attempt after 2000 ms');
  });

  it('judges no adapter behind the port that the default policy cuts as well, nor one that states no limit', () => {
    const cases = [
      "@Adapter(ModelReader, { kind: 'external', aspects: [timeout(120_000)] })",
      '@Adapter(ModelReader, { kind: kindOf(environment), aspects: [timeout(120_000)] })',
      "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy(retry({ attempts: 2 }))] })",
      "@Adapter(ModelReader, { kind: 'external' })",
    ];

    expect(cases.flatMap((inner) => reported(delegating(DEFAULTED, inner), RULE))).toEqual([]);
  });

  it('judges nothing through a middle adapter: only the adapter bound to the port given is read', () => {
    const root = project({
      [QUOTES]: declared(DEFAULTED, 'RemoteQuoteReader', '  constructor(private readonly prices: PriceReader) {}'),
      [`${EXTERNAL}/remote-price-reader.adapter.ts`]: declared(
        '@Adapter(PriceReader, { aspects: [ownPolicy()] })',
        'RemotePriceReader',
        GIVEN_THE_MODELS,
      ),
      [MODELS]: declared(SLOW, 'RemoteModelReader'),
      [SETTINGS]: DEFAULTS,
    });

    expect(reported(root, RULE)).toEqual([]);
  });
});

describe(`${RULE}, what the text does not show`, () => {
  it('judges no adapter whose policy or kind it cannot read, in front of the port or behind it', () => {
    const unreadable = [
      '@Adapter(QuoteReader, { kind: kindOf(environment) })',
      '@Adapter(QuoteReader, options)',
      "@Adapter(QuoteReader, { kind: 'external', ...shared })",
      "@Adapter(QuoteReader, { kind: 'external', aspects })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [slowPolicy] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [...policies] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [policyOf(settings)] })",
      "@Adapter(QuoteReader, { kind: 'external', aspects: [when(forMethods('ping'), retry({ attempts: 2 }))] })",
    ];

    const behind = [
      '@Adapter(ModelReader, { aspects: [ownPolicy(timeout(limit))] })',
      '@Adapter(ModelReader, { aspects: [ownPolicy(timeout(120_000)), slowPolicy] })',
      "@Adapter(ModelReader, { aspects: [ownPolicy(when(forMethods('read'), timeout(120_000)))] })",
    ];

    expect(unreadable.flatMap((outer) => reported(delegating(outer), RULE))).toEqual([]);
    expect(behind.flatMap((inner) => reported(delegating(DEFAULTED, inner), RULE))).toEqual([]);
  });

  it('takes the default limit from the one place the platform reads OUTBOUND_TIMEOUT_MS, which main.ts runs with', () => {
    const configured = (config: string): string =>
      project({
        [QUOTES]: declared(DEFAULTED, 'RemoteQuoteReader', GIVEN_THE_MODELS),
        [MODELS]: declared(SLOW, 'RemoteModelReader'),
        [SETTINGS]: DEFAULTS,
        [CONFIG]: config,
      });

    const read = (options: string): string => `export const ms = env.integer('OUTBOUND_TIMEOUT_MS', ${options});\n`;

    expect(reported(configured(read('{ fallback: 150_000, min: 1 }')), RULE)).toEqual([]);
    expect(reported(configured(read('{ min: 1, fallback: 30_000 }')), RULE)[0]?.message).toContain('after 30000 ms');
    expect(reported(configured(read('{ fallback: 2 * SECOND }')), RULE)).toEqual([]);
    expect(reported(configured(read('{ min: 1 }')), RULE)).toEqual([]);
    expect(reported(configured(`${read('{ fallback: 1_000 }')}${read('{ fallback: 1_000 }')}`), RULE)).toEqual([]);

    expect(reported(configured("export const NAMES = ['OUTBOUND_TIMEOUT_MS', { fallback: 1_000 }];\n"), RULE)).toEqual(
      [],
    );
  });

  it('judges no default it cannot read: settings that are not one number, a project without them', () => {
    const withSettings = (settings: Record<string, string>): string =>
      project({
        [QUOTES]: declared(DEFAULTED, 'RemoteQuoteReader', GIVEN_THE_MODELS),
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

describe(`${RULE}, bindings it does not judge`, () => {
  it('judges no port and no adapter bound more than once, bound again by rebind, or bound under a condition', () => {
    const roots = [
      bound(DEFAULTED_BOUND, SLOW_BOUND, '  builder.bind(ModelReader).toValue(fastModels);'),
      bound(DEFAULTED_BOUND, SLOW_BOUND, "  builder.bind(Quotes).toClass(RemoteQuoteReader).as('external');"),
      bound(DEFAULTED_BOUND, SLOW_BOUND, '  builder.rebind(ModelReader).toClass(FastModelReader);'),
      bound(DEFAULTED_BOUND, SLOW_BOUND, '  builder.rebind(QuoteReader).toClass(RemoteQuoteReader).with(ownPolicy());'),
      bound(DEFAULTED_BOUND, '  if (settings.remote) {', `  ${SLOW_BOUND}`, '  }'),
      bound(DEFAULTED_BOUND, '  if (isOn({ remote: true })) {', `  ${SLOW_BOUND}`, '  } else {', '    other();', '  }'),
      bound(DEFAULTED_BOUND, `  if (settings.remote) ${SLOW_BOUND.trim()}`),
      bound(DEFAULTED_BOUND, `  const models = settings.remote ? ${SLOW_BOUND.trim().slice(0, -1)} : undefined;`),
      bound(DEFAULTED_BOUND, `  settings.remote && ${SLOW_BOUND.trim()}`),
      bound(DEFAULTED_BOUND, '  when(settings.remote, () => {', `  ${SLOW_BOUND}`, '  });'),
      bound(
        SLOW_BOUND,
        '  for (const kind of kinds) {',
        '    builder.bind(QuoteReader).toClass(RemoteQuoteReader).as(kind);',
        '  }',
      ),
    ];

    expect(roots.map((root) => reported(root, RULE).length)).toEqual(roots.map(() => 0));
  });

  it('judges no binding whose statement starts with more than its receiver, down to the first line of a file', () => {
    const root = project({
      [QUOTES]: declared(DEFAULTED, 'RemoteQuoteReader', GIVEN_THE_MODELS),
      [MODELS]: 'export class RemoteModelReader {}\n',
      [SETTINGS]: DEFAULTS,
      [MODULE]: `import * as di from '@ddd-ts-kit/di'\n${SLOW_BOUND.trim()}\n`,
    });

    expect(reported(root, RULE)).toEqual([]);
  });

  it('still judges a binding written after a block that is closed, and inside a callback', () => {
    const afterBlock = bound('  if (settings.verbose) {', '    log();', '  }', DEFAULTED_BOUND, SLOW_BOUND);
    const inCallback = bound('  register(() => {', `  ${DEFAULTED_BOUND}`, `  ${SLOW_BOUND}`, '  });');

    expect(reported(afterBlock, RULE)).toHaveLength(1);
    expect(reported(inCallback, RULE)).toHaveLength(1);
  });

  it('finds a class two files declare by the import of the file that binds it, and leaves it without one', () => {
    const twice = (importOfTheClass: string): string =>
      project({
        [QUOTES]: GIVEN,
        [`${SHIPPING}/infrastructure/external/remote-quote-reader.adapter.ts`]: 'export class RemoteQuoteReader {}\n',
        [MODELS]: 'export class RemoteModelReader {}\n',
        [SETTINGS]: DEFAULTS,
        [MODULE]: lines(
          "import type { ContainerBuilder } from '@ddd-ts-kit/di';",
          importOfTheClass,
          'export function billingModule(builder: ContainerBuilder): void {',
          DEFAULTED_BOUND,
          SLOW_BOUND,
          "  builder.bind(PriceCatalog).toClass(RemotePriceCatalog).as('external');",
          '}',
        ),
      });

    const imported = twice(
      "import { RemoteQuoteReader } from './infrastructure/external/remote-quote-reader.adapter';",
    );

    expect(reported(imported, RULE).map(({ file }) => file)).toEqual([QUOTES]);
    expect(reported(twice(''), RULE)).toEqual([]);
  });
});
