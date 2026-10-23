import { describe, expect, it } from 'vitest';
import { loadSourceFile } from '../src/check/project/load-source-file';
import { parseConfig } from '../src/config';
import { generatedDrift, renderDeclarations, renderDependenciesFile, renderInjections } from '../src/declared';
import { readInjections } from '../src/declared/injection/read-injections';

const config = parseConfig({ contexts: { billing: { classification: 'core', upstreams: [] } } });
const BILLING = 'src/contexts/billing';
const DECLARATIONS = "import { Adapter, CommandHandler, Repository } from '@ddd-ts-kit/kernel/declarations';";
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const specifier = (file: string): string => `@/${file.replace(/^src\//, '').replace(/\.ts$/, '')}`;

describe('what a constructor is read as', () => {
  it('names each token by the name its module exports it under, whatever the file calls it', () => {
    const [injection] = injectionsOf({
      [HANDLER]: handler(
        "import type { Clock as Time } from '@ddd-ts-kit/kernel';\nimport { type InvoiceRepository as Invoices } from '@/contexts/billing/domain/repositories/invoice.repository';",
        '',
        '  constructor(\n    private readonly invoices: Invoices,\n    private readonly time: Time,\n  ) {}\n',
      ),
    });

    expect(injection).toMatchObject({
      className: 'IssueInvoiceHandler',
      listed: undefined,
      readable: true,
      problems: [],
    });

    expect(injection?.dependencies).toEqual([
      {
        name: 'InvoiceRepository',
        from: { kind: 'file', path: `${BILLING}/domain/repositories/invoice.repository.ts` },
      },
      { name: 'Clock', from: { kind: 'package', specifier: '@ddd-ts-kit/kernel' } },
    ]);
  });

  it('reads a class without a constructor as taking nothing, and the list of a decorator as written', () => {
    const [bare] = injectionsOf({ [HANDLER]: handler('', '', '') });

    const [listed] = injectionsOf({
      [HANDLER]: handler('', '', '').replace(
        '@CommandHandler(IssueInvoice)',
        '@CommandHandler(IssueInvoice, [\n  A,\n  B,\n])',
      ),
    });

    expect(bare).toMatchObject({ dependencies: [], listed: undefined, problems: [] });
    expect(listed?.listed).toEqual(['A', 'B']);
  });

  it('follows an inherited constructor to the class of the project that writes it, through its imports', () => {
    const base = `${BILLING}/infrastructure/persistence/stored.ts`;
    const repository = `${BILLING}/infrastructure/persistence/in-memory-invoice.repository.ts`;

    const files = {
      [base]:
        "import type { Clock } from '@ddd-ts-kit/kernel';\n\nexport abstract class Stored {\n  constructor(protected readonly clock: Clock) {}\n}\n",
      [repository]: `${DECLARATIONS}\nimport { Stored } from '@/contexts/billing/infrastructure/persistence/stored';\n\n@Repository(InvoiceRepository)\nexport class InMemoryInvoiceRepository extends Stored {}\n`,
    };

    expect(injectionsOf(files, repository)[0]).toMatchObject({
      readable: true,
      problems: [],
      dependencies: [{ name: 'Clock', from: { kind: 'package', specifier: '@ddd-ts-kit/kernel' } }],
    });
  });

  it('cannot read a constructor inherited from a package, and says what to write instead', () => {
    const [injection] = injectionsOf({
      [HANDLER]: handler(
        "import { KnexReadModelStore } from '@ddd-ts-kit/knex';",
        'extends KnexReadModelStore<Row> ',
        '',
      ),
    });

    expect(injection).toMatchObject({ readable: false, dependencies: undefined });

    expect(injection?.problems[0]?.message).toBe(
      'IssueInvoiceHandler inherits its constructor from a class this project cannot read: nothing states what it is given.',
    );

    expect(injection?.problems[0]?.fix).toContain('Write the constructor in the class');
  });

  it('refuses an interface, a type alias and an unexported class, of the file or of another file of the project', () => {
    const port = `${BILLING}/application/ports/settings.port.ts`;

    const files = {
      [port]: 'export interface Settings {\n  readonly currency: string;\n}\n\nexport type Limit = number;\n',
      [HANDLER]: handler(
        "import type { Limit, Settings } from '@/contexts/billing/application/ports/settings.port';",
        '',
        '  constructor(\n    readonly settings: Settings,\n    readonly limit: Limit,\n    readonly hidden: Hidden,\n    readonly local: Local,\n  ) {}\n',
      ).concat('\nclass Hidden {}\n\nenum Local {}\n'),
    };

    expect(injectionsOf(files)[0]?.problems.map(({ message }) => message)).toEqual([
      `Parameter "settings" of the constructor of IssueInvoiceHandler is typed \`Settings\`, an interface of ${port}: only a class exists at run time and can be an injection token.`,
      `Parameter "limit" of the constructor of IssueInvoiceHandler is typed \`Limit\`, a type alias of ${port}: only a class exists at run time and can be an injection token.`,
      'Parameter "hidden" of the constructor of IssueInvoiceHandler is typed `Hidden`, a class its file does not export: nothing outside the file can name it.',
      `Parameter "local" of the constructor of IssueInvoiceHandler is typed \`Local\`, an enum of ${HANDLER}: only a class exists at run time and can be an injection token.`,
    ]);
  });
});

describe('what the generated file of a context holds', () => {
  const kernel = (name: string) => ({ name, from: { kind: 'package' as const, specifier: '@ddd-ts-kit/kernel' } });
  const local = (name: string, file: string) => ({ name, from: { kind: 'file' as const, path: file } });

  const injection = (className: string, dependencies: ReturnType<typeof kernel>[] | ReturnType<typeof local>[]) => ({
    className,
    file: `${BILLING}/application/commands/${className}.handler.ts`,
    line: 1,
    listed: undefined,
    readable: true,
    problems: [],
    dependencies,
  });

  it('holds one call per class that takes something, and one import per module, names sorted', () => {
    const injected = renderInjections(
      [
        injection('Issue', [kernel('IdGenerator'), kernel('Clock')]),
        injection('Cancel', []),
        injection('Void', [kernel('Clock')]),
      ],
      specifier,
    );

    expect(injected.imports).toEqual([
      "import { injected } from '@ddd-ts-kit/kernel/declarations';",
      "import { Issue } from '@/contexts/billing/application/commands/Issue.handler';",
      "import { Void } from '@/contexts/billing/application/commands/Void.handler';",
      "import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';",
    ]);

    expect(injected.calls).toEqual(['injected(Issue, [IdGenerator, Clock]);', 'injected(Void, [Clock]);']);
    expect(renderInjections([injection('Cancel', [])], specifier)).toEqual({ imports: [], calls: [] });
    expect(renderDependenciesFile({ imports: [], calls: [] }, [])).toBe('export {};\n');

    expect(renderDependenciesFile(injected, [])).toBe(
      `${injected.imports.join('\n')}\n\n${injected.calls.join('\n')}\n`,
    );

    // The modules of the model the context declares, where discovery reads them, between the imports and the calls.
    expect(renderDependenciesFile({ imports: [], calls: [] }, ['invoices'])).toBe(
      "/** The modules of the model, as ddd-ts-kit.config.json declares them: discovery reads the role files of each. */\nexport const modules = ['invoices'];\n",
    );

    expect(renderDependenciesFile(injected, ['invoices', 'reminders'])).toBe(
      `${injected.imports.join('\n')}\n\n/** The modules of the model, as ddd-ts-kit.config.json declares them: discovery reads the role files of each. */\nexport const modules = ['invoices', 'reminders'];\n\n${injected.calls.join('\n')}\n`,
    );
  });

  it('leaves out a class whose decorator lists its dependencies, and one whose constructor could not be read', () => {
    const listed = { ...injection('Listed', [kernel('Clock')]), listed: ['Clock'] };
    const unread = { ...injection('Unread', []), dependencies: undefined };

    expect(renderInjections([listed, unread], specifier).calls).toEqual([]);
  });

  it('binds a second class of the same name under another one, so that two ports called alike never collide', () => {
    const settings = (context: string) =>
      local('Settings', `src/contexts/${context}/application/ports/settings.port.ts`);

    const injected = renderInjections([injection('Issue', [settings('billing'), settings('catalog')])], specifier);

    expect(injected.calls).toEqual(['injected(Issue, [Settings, Settings_2]);']);

    expect(injected.imports).toContain(
      "import { Settings as Settings_2 } from '@/contexts/catalog/application/ports/settings.port';",
    );
  });

  it('is laid out as the formatter lays it out: a long call and a long import of several names are broken, an import of one name never', () => {
    const long = ['IntegrationEventPublisher', 'DomainEventDispatcher', 'IntegrationEventSubscriber', 'ExecutionScope'];
    const more = ['CommandBus', 'QueryBus', 'UnitOfWork', 'IdGenerator', 'Clock'];

    const injected = renderInjections(
      [injection('ReconcileEveryLedgerOfTheMonth', [...long, ...more].map(kernel))],
      specifier,
    );

    expect(injected.calls).toEqual([
      `injected(ReconcileEveryLedgerOfTheMonth, [\n${[...long, ...more].map((name) => `  ${name},\n`).join('')}]);`,
    ]);

    expect(injected.imports.at(-1)).toBe(
      `import {\n${[...long, ...more]
        .sort()
        .map((name) => `  ${name},\n`)
        .join('')}} from '@ddd-ts-kit/kernel';`,
    );

    const far = injection('Issue', [local('Clock', `${BILLING}/${'deeply/nested/'.repeat(8)}clock.port.ts`)]);

    expect(renderInjections([far], specifier).imports.at(-1)).toMatch(/^import \{ Clock \} from '.{120,}';$/);
  });

  it('sets a call the width broke apart from its neighbours by a blank line, as the layout rules of a project want', () => {
    const broken = 'injected(Invite, [\n  Members,\n  Tokens,\n]);';

    const injected = {
      imports: ["import { injected } from 'k';"],
      calls: ['injected(Accept, [Clock]);', broken, 'injected(Open, [Ids]);'],
    };

    expect(renderDependenciesFile(injected, [])).toBe(
      `import { injected } from 'k';\n\ninjected(Accept, [Clock]);\n\n${broken}\n\ninjected(Open, [Ids]);\n`,
    );
  });
});

describe('the declarations of a role folder, and how a written one drifts', () => {
  it('follows the exports of the declarations, and says in words what tells a written file from the expected one', () => {
    const files = [
      'application/commands/issue/issue.handler.ts',
      'CONTEXT.md',
      'domain/aggregates/invoice.aggregate.ts',
    ];

    const injected = { imports: ["import { injected } from 'k';"], calls: ['injected(Issue, [Clock, Ids]);'] };

    const render = (from: readonly string[], given = injected): Map<string, string> =>
      renderDeclarations({
        context: 'billing',
        files: from,
        modules: [],
        specifierOf: (file) => `@/${file}`,
        injectedIn: () => given,
      });

    const barrel = render(files).get('application/application.declarations.ts') ?? '';

    expect(barrel).toBe(
      "import { injected } from 'k';\n\nexport * from '@/application/commands/issue/issue.handler.ts';\n\ninjected(Issue, [Clock, Ids]);\n",
    );

    expect(render(files, { imports: [], calls: [] })).toEqual(
      new Map([
        ['application/application.declarations.ts', "export * from '@/application/commands/issue/issue.handler.ts';\n"],
        ['billing.declarations.ts', "export * from '@/application/application.declarations.ts';\n"],
      ]),
    );

    expect(render(['CONTEXT.md'])).toEqual(new Map([['billing.declarations.ts', 'export {};\n']]));

    expect(generatedDrift(barrel.replace('[Clock, Ids]', '[\n  Clock,\n]'), barrel)).toBe(
      'the dependency list of Issue is stale: its constructor takes [Clock, Ids] and the file says [Clock]',
    );

    expect(generatedDrift(`${barrel}injected(Gone, [Clock]);\n`, barrel)).toBe(
      'it registers a dependency list for Gone, whose constructor takes nothing the generator reads any more',
    );

    expect(generatedDrift(barrel.replace('export *', 'export  *'), barrel)).toContain('does not export');
    expect(generatedDrift(`${barrel}\n`, barrel)).toBe('it is not laid out as the generator writes it');
  });
});

/** The injections of the role file `file` of a project made of `files`. */
function injectionsOf(files: Readonly<Record<string, string>>, file = HANDLER) {
  const sources = (path: string) => {
    const text = files[path];

    return text === undefined ? undefined : loadSourceFile(config, path, text);
  };

  const source = sources(file);

  return source === undefined ? [] : readInjections(sources, source);
}

function handler(imports: string, heritage: string, body: string): string {
  return `${DECLARATIONS}\n${imports}\n\n@CommandHandler(IssueInvoice)\nexport class IssueInvoiceHandler ${heritage}{\n${body}}\n`;
}
