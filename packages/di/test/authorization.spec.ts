import { describe, expect, it } from 'vitest';
import {
  ActorContext,
  AuthorizedCommand,
  AuthorizedQuery,
  Command,
  CommandBus,
  FixedActorContext,
  InMemoryUnitOfWork,
  Query,
  QueryBus,
  UnitOfWork,
  systemActor,
  type Actor,
} from '@ddd-ts-kit/kernel';
import {
  UseCaseDeclarations,
  UseCaseGuard,
  createApplication,
  createTestApplication,
  defineContextModule,
  fake,
  kernelModule,
  override,
} from '../src';
import { wiringFailure } from './support/failure';

const issueInvoice = { id: 'billing:invoice.issue' };
const readInvoices = { id: 'billing:invoice.read' };
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

class IssueInvoice extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

class SearchInvoices extends AuthorizedQuery<readonly string[]> {}
class GetCatalog extends Query<readonly string[]> {}
class ArchiveInvoices extends Command {}
class PurgeInvoices extends Command {}

class IssueInvoiceHandler {
  async execute(command: IssueInvoice): Promise<string> {
    return `invoice for ${command.customerId}`;
  }
}

const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder
      .command(IssueInvoice)
      .requires(issueInvoice, {
        resource: (command) => ({ type: 'customer', id: command.customerId }),
        context: (command) => ({ onBehalfOf: command.actor.id }),
      })
      .handledBy(IssueInvoiceHandler);

    builder
      .query(SearchInvoices)
      .requires(readInvoices)
      .handledByFactory(() => ({ execute: async () => ['inv-1'] }));

    builder
      .query(GetCatalog)
      .public()
      .handledByFactory(() => ({ execute: async () => ['book'] }));
  },
});

const archivingModule = defineContextModule({
  name: 'archiving',
  register(builder) {
    builder.command(ArchiveInvoices).handledByFactory(() => ({ execute: async () => undefined }));
    builder.command(PurgeInvoices).handledByFactory(() => ({ execute: async () => undefined }));
  },
});

const refuseEverything: UseCaseGuard = {
  check: async () => {
    throw new RangeError('refused by the guard');
  },
};

const guardModule = defineContextModule({
  name: 'authorization',
  register(builder) {
    builder.bind(UseCaseGuard).toValue(refuseEverything);
  },
});

describe('declaring the access to a use case next to its handler', () => {
  it('records what each command and query requires, as data', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule, archivingModule] });

    const declarations = app.resolve(UseCaseDeclarations).list;

    const summary = declarations.map(({ kind, message, module, access, permission }) => ({
      kind,
      message: message.name,
      module,
      access,
      permission,
    }));

    expect(summary).toEqual([
      { kind: 'command', message: 'IssueInvoice', module: 'billing', access: 'protected', permission: issueInvoice },
      { kind: 'query', message: 'SearchInvoices', module: 'billing', access: 'protected', permission: readInvoices },
      { kind: 'query', message: 'GetCatalog', module: 'billing', access: 'public', permission: undefined },
      { kind: 'command', message: 'ArchiveInvoices', module: 'archiving', access: undefined, permission: undefined },
      { kind: 'command', message: 'PurgeInvoices', module: 'archiving', access: undefined, permission: undefined },
    ]);
  });

  it('derives the resource and the context from the message it was declared for', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });
    const [issuing] = app.resolve(UseCaseDeclarations).list;
    const command = new IssueInvoice(ada, 'customer-1');

    expect(issuing?.resourceOf?.(command)).toEqual({ type: 'customer', id: 'customer-1' });
    expect(issuing?.contextOf?.(command)).toEqual({ onBehalfOf: 'ada' });
    expect(issuing?.resourceOf?.(new ArchiveInvoices())).toBeUndefined();
  });

  it('shows the access in the description of the wiring', () => {
    const { commands, queries } = createApplication({
      modules: [kernelModule(), billingModule, archivingModule],
    }).describe();

    expect(commands).toEqual([
      {
        message: 'IssueInvoice',
        handler: 'IssueInvoiceHandler',
        module: 'billing',
        access: 'protected',
        permission: 'billing:invoice.issue',
      },
      { message: 'ArchiveInvoices', handler: 'command(ArchiveInvoices) handler', module: 'archiving' },
      { message: 'PurgeInvoices', handler: 'command(PurgeInvoices) handler', module: 'archiving' },
    ]);

    expect(queries.map(({ message, access }) => [message, access])).toEqual([
      ['SearchInvoices', 'protected'],
      ['GetCatalog', 'public'],
    ]);
  });

  it('only offers requires for a message that carries its actor', () => {
    const module = defineContextModule({
      name: 'catalog',
      register(builder) {
        builder
          .query(GetCatalog)
          // @ts-expect-error -- GetCatalog extends Query, not AuthorizedQuery: there is no actor to hold the permission
          .requires(readInvoices)
          .handledByFactory(() => ({ execute: async () => [] }));
      },
    });

    expect(module.name).toBe('catalog');
  });

  it('refuses a declaration left without its handler', () => {
    const unfinished = defineContextModule({
      name: 'billing',
      register(builder) {
        builder.command(IssueInvoice).requires(issueInvoice);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), unfinished] }));

    expect(error.code).toBe('INCOMPLETE_BINDING');
    expect(error.message).toContain('command(IssueInvoice) without handledBy or handledByFactory');
  });
});

describe('authorization: required', () => {
  it('refuses to create an application in which a use case declares no access, naming each', () => {
    const error = wiringFailure(() =>
      createApplication({
        modules: [kernelModule(), billingModule, archivingModule, guardModule],
        authorization: 'required',
      }),
    );

    expect(error.code).toBe('UNDECLARED_AUTHORIZATION');

    expect(error.message).toBe(
      'Authorization is required and the command "ArchiveInvoices" (module "archiving"), the command "PurgeInvoices" (module "archiving") declare no access. Write .requires(permission) or .public() before handledBy.',
    );
  });

  it('refuses an application in which nothing would check the declared permissions', () => {
    const error = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), billingModule], authorization: 'required' }),
    );

    expect(error.code).toBe('AUTHORIZATION_NOT_ENFORCED');

    expect(error.message).toBe(
      'Authorization is required but no module binds "UseCaseGuard": the declared permissions would never be checked. Add an authorization module to the modules.',
    );
  });

  it('accepts an application that declares everything and binds a guard', () => {
    expect(() =>
      createApplication({ modules: [kernelModule(), billingModule, guardModule], authorization: 'required' }),
    ).not.toThrow();

    expect(() =>
      createApplication({
        modules: [kernelModule(), billingModule],
        overrides: [override(UseCaseGuard, refuseEverything)],
        authorization: 'required',
      }),
    ).not.toThrow();
  });

  it('is not the default: an application without declarations keeps working', async () => {
    const app = createApplication({ modules: [kernelModule(), archivingModule] });

    await expect(app.resolve(CommandBus).execute(new ArchiveInvoices())).resolves.toBeUndefined();
  });

  it('holds a test application to the same declarations', () => {
    const error = wiringFailure(() =>
      createTestApplication({ modules: [billingModule, archivingModule], authorization: 'required' }),
    );

    expect(error.code).toBe('UNDECLARED_AUTHORIZATION');
    expect(() => createTestApplication({ modules: [billingModule], authorization: 'required' })).not.toThrow();
  });
});

describe('the use case guard', () => {
  class CountingUnitOfWork extends InMemoryUnitOfWork {
    opened = 0;

    override run<T>(work: () => Promise<T>): Promise<T> {
      this.opened += 1;

      return super.run(work);
    }
  }

  it('lets every message through when no module binds it', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    expect(await app.resolve(CommandBus).execute(new IssueInvoice(ada, 'customer-1'))).toBe('invoice for customer-1');
    expect(await app.resolve(QueryBus).execute(new GetCatalog())).toEqual(['book']);
  });

  it('runs before the handlers of both buses, and before the unit of work', async () => {
    const unitOfWork = new CountingUnitOfWork();

    const app = createApplication({
      modules: [kernelModule({ unitOfWork }), billingModule, guardModule],
    });

    await expect(app.resolve(CommandBus).execute(new IssueInvoice(ada, 'customer-1'))).rejects.toBeInstanceOf(
      RangeError,
    );

    await expect(app.resolve(QueryBus).execute(new GetCatalog())).rejects.toBeInstanceOf(RangeError);
    expect(unitOfWork.opened).toBe(0);
  });

  it('guards a test application as well when a module binds it, and allows everything otherwise', async () => {
    const unitOfWork = new CountingUnitOfWork();

    const guarded = createTestApplication({
      modules: [billingModule, guardModule],
      fakes: [fake(UnitOfWork, unitOfWork)],
    });

    const open = createTestApplication({ modules: [billingModule] });

    await expect(guarded.commandBus.execute(new IssueInvoice(ada, 'customer-1'))).rejects.toBeInstanceOf(RangeError);
    await expect(guarded.queryBus.execute(new SearchInvoices(ada))).rejects.toBeInstanceOf(RangeError);
    expect(unitOfWork.opened).toBe(0);
    expect(await open.queryBus.execute(new SearchInvoices(ada))).toEqual(['inv-1']);
  });

  it('can be faked in a test', async () => {
    const seen: string[] = [];

    const app = createTestApplication({
      modules: [billingModule, guardModule],
      fakes: [fake(UseCaseGuard, { check: (_message, next, info) => (seen.push(info.name), next()) })],
    });

    await app.queryBus.execute(new GetCatalog());

    expect(seen).toEqual(['GetCatalog']);
  });
});

describe('the actor context', () => {
  it('is bound by the kernel module, one asynchronous chain per request', async () => {
    const app = createApplication({ modules: [kernelModule()] });
    const context = app.resolve(ActorContext);

    expect(context.current()).toBeUndefined();
    expect(await context.run(ada, async () => context.require().id)).toBe('ada');
  });

  it('can be replaced through the options of the kernel module', () => {
    const fixed = new FixedActorContext(systemActor('job'));

    expect(createApplication({ modules: [kernelModule({ actorContext: fixed })] }).resolve(ActorContext)).toBe(fixed);
  });

  it('holds a default user in a test application, or the actor the test names', () => {
    const byDefault = createTestApplication({ modules: [] });
    const named = createTestApplication({ modules: [], actor: ada });

    expect(byDefault.get(ActorContext).require()).toEqual({ id: 'test-user', type: 'user', roles: [], attributes: {} });
    expect(named.get(ActorContext).require()).toBe(ada);
    expect(named.actorContext).toBe(named.get(ActorContext));
  });

  it('lets a test change who is acting', () => {
    const app = createTestApplication({ modules: [], actor: ada });

    app.actorContext.actAs(systemActor('job'));

    expect(app.get(ActorContext).require().id).toBe('system:job');
  });
});
