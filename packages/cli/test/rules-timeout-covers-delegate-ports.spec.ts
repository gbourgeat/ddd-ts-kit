import { describe, expect, it } from 'vitest';
import { lines, projectWith, reported } from './rules-support';

const RULE = 'aspects/timeout-covers-delegate';
const EXTERNAL = 'src/contexts/billing/infrastructure/external';
const QUOTES = `${EXTERNAL}/remote-quote-reader.adapter.ts`;
const MODELS = `${EXTERNAL}/remote-model-reader.adapter.ts`;
const SETTINGS = 'src/platform/resilience/default-resilience-settings.ts';
const PORT = 'src/contexts/billing/application/ports/model-reader.port.ts';
const SHIPPING = 'src/contexts/shipping';
const DIRECT = '../../application/ports/model-reader.port';
const A_PORT = 'export abstract class ModelReader {}\n';
const DEFAULTS = 'export const defaultResilienceSettings = { timeoutMs: 2_000 };\n';
const DEFAULTED = "@Adapter(QuoteReader, { kind: 'external' })";
const SLOW = "@Adapter(ModelReader, { kind: 'external', aspects: [ownPolicy(timeout(120_000))] })";
const GIVEN_THE_MODELS = '  constructor(private readonly models: ModelReader) {}';

/** A project that declares the port the two adapters name, and the files given. */
function project(files: Readonly<Record<string, string>>): string {
  return projectWith({ [PORT]: A_PORT, ...files });
}

/** A role file of the declared style that imports the port from `port`, or from nowhere. */
function declaredFrom(port: string | undefined, decorator: string, name: string, ...members: string[]): string {
  return lines(
    "import { Adapter } from '@ddd-ts-kit/kernel/declarations';",
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

describe(`${RULE}, two ports of one name`, () => {
  const quotes = declared(DEFAULTED, 'RemoteQuoteReader', GIVEN_THE_MODELS);
  const inShipping = `${SHIPPING}/infrastructure/external/remote-model-reader.adapter.ts`;

  const ports = {
    [PORT]: A_PORT,
    [`${SHIPPING}/application/ports/model-reader.port.ts`]: A_PORT,
    [`${SHIPPING}/application/index.ts`]: "export { ModelReader } from './ports/model-reader.port';\n",
    [SETTINGS]: DEFAULTS,
  };

  it('reports when each file imports the port from the one file that declares it', () => {
    const root = projectWith({ ...ports, [QUOTES]: quotes, [MODELS]: declared(SLOW, 'RemoteModelReader') });

    expect(reported(root, RULE).map(({ file }) => file)).toEqual([QUOTES]);
  });

  it('judges nothing when the two files import two ports, or when one reaches its port through a barrel or no import', () => {
    const roots = [
      projectWith({ ...ports, [QUOTES]: quotes, [inShipping]: declared(SLOW, 'RemoteModelReader') }),
      projectWith({
        ...ports,
        [QUOTES]: quotes,
        [inShipping]: declaredFrom('../../application', SLOW, 'RemoteModelReader'),
      }),
      projectWith({ ...ports, [QUOTES]: quotes, [MODELS]: declaredFrom(undefined, SLOW, 'RemoteModelReader') }),
      projectWith({
        ...ports,
        [QUOTES]: declaredFrom(undefined, DEFAULTED, 'RemoteQuoteReader', GIVEN_THE_MODELS),
        [MODELS]: declared(SLOW, 'RemoteModelReader'),
      }),
      projectWith({
        ...ports,
        [QUOTES]: quotes,
        [inShipping]: `${A_PORT}${declaredFrom(undefined, SLOW, 'RemoteModelReader')}`,
      }),
    ];

    expect(roots.map((root) => reported(root, RULE).length)).toEqual(roots.map(() => 0));
  });
});

describe(`${RULE}, a type that only has the name of a port`, () => {
  const behind = { [MODELS]: declared(SLOW, 'RemoteModelReader'), [SETTINGS]: DEFAULTS };

  const outer = (port: string | undefined, ...before: string[]): string =>
    `${before.join('')}${declaredFrom(port, DEFAULTED, 'RemoteQuoteReader', GIVEN_THE_MODELS)}`;

  it('judges no adapter whose parameter is typed by a package, by a declaration of its own file, or by no import', () => {
    const roots = [
      project({ ...behind, [QUOTES]: outer('some-model-sdk') }),
      project({ ...behind, [QUOTES]: outer(undefined, 'interface ModelReader {\n  read(): void;\n}\n') }),
      project({ ...behind, [QUOTES]: outer(undefined, 'abstract class ModelReader {}\n') }),
      project({ ...behind, [QUOTES]: outer(undefined) }),
      projectWith({ ...behind, [QUOTES]: outer(DIRECT) }),
      project({
        [QUOTES]: outer(DIRECT),
        [MODELS]: declaredFrom('some-model-sdk', SLOW, 'RemoteModelReader'),
        [SETTINGS]: DEFAULTS,
      }),
    ];

    expect(roots.map((root) => reported(root, RULE).length)).toEqual(roots.map(() => 0));
  });

  it('judges it through a barrel of the project when one port carries that name', () => {
    const root = project({
      ...behind,
      'src/contexts/billing/application/index.ts': "export { ModelReader } from './ports/model-reader.port';\n",
      [QUOTES]: outer('../../application'),
    });

    expect(reported(root, RULE)).toHaveLength(1);
  });
});
