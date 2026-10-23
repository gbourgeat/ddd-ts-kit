import { describe, expect, it } from 'vitest';
import {
  Command,
  InMemoryCommandBus,
  InMemoryQueryBus,
  InMemoryUnitOfWork,
  FixedExecutionScope,
  anonymousActor,
  executionContext,
  unitOfWorkMiddleware,
} from '@ddd-ts-kit/kernel';
import {
  AuthorizationMap,
  AuthorizationSetupError,
  ForbiddenError,
  MissingActorError,
  UnauthenticatedError,
  UndeclaredUseCaseError,
  authorizationMiddleware,
  publicUseCase,
  requires,
  type DecisionRecord,
} from '../src';
import { DenyAll, RecordingAuthorizer } from '../src/testing';
import {
  ArchiveInvoices,
  GetCatalog,
  IssueInvoice,
  SearchInvoices,
  VoidInvoice,
  ada,
  billingPermissions,
} from './support/billing';

const map = AuthorizationMap.of(
  requires(IssueInvoice, billingPermissions['invoice.issue']),
  requires(VoidInvoice, billingPermissions['invoice.void'], {
    resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
    context: (command) => ({ tenantId: command.tenantId }),
  }),
  requires(SearchInvoices, billingPermissions['invoice.read']),
  publicUseCase(GetCatalog),
);

class CountingUnitOfWork extends InMemoryUnitOfWork {
  opened = 0;

  override run<T>(work: () => Promise<T>): Promise<T> {
    this.opened += 1;

    return super.run(work);
  }
}

function application(authorizer = new RecordingAuthorizer()) {
  const audit: DecisionRecord[] = [];
  const handled: string[] = [];
  const unitOfWork = new CountingUnitOfWork();
  const guard = authorizationMiddleware({ authorizer, map, onDecision: (record) => void audit.push(record) });

  const commands = new InMemoryCommandBus()
    .use(guard)
    .use(unitOfWorkMiddleware(unitOfWork))
    .register(IssueInvoice, { execute: async (command) => `invoice for ${command.customerId}` })
    .register(VoidInvoice, { execute: async (command) => void handled.push(command.invoiceId) })
    .register(ArchiveInvoices, { execute: async () => void handled.push('archived') });

  const queries = new InMemoryQueryBus()
    .use(guard)
    .register(SearchInvoices, { execute: async () => ['inv-1'] })
    .register(GetCatalog, { execute: async () => ['book'] });

  return { authorizer, audit, handled, unitOfWork, commands, queries };
}

describe('authorizationMiddleware', () => {
  it('lets a protected command through when the authorizer allows its actor', async () => {
    const { commands, authorizer } = application();

    expect(await commands.execute(new IssueInvoice(ada, 'customer-1'))).toBe('invoice for customer-1');
    expect(authorizer.checks).toEqual([{ actor: ada, permission: billingPermissions['invoice.issue'] }]);
  });

  it('asks about the resource and the context the declaration derives from the message', async () => {
    const { commands, authorizer } = application();

    await commands.execute(new VoidInvoice(ada, 'inv-7', 'globex'));

    expect(authorizer.checks).toEqual([
      {
        actor: ada,
        permission: billingPermissions['invoice.void'],
        resource: { type: 'invoice', id: 'inv-7' },
        context: { tenantId: 'globex' },
      },
    ]);
  });

  it('tells the authorizer the tenant of the work when it is given the execution scope', async () => {
    const authorizer = new RecordingAuthorizer();
    const scope = new FixedExecutionScope(executionContext({ correlationId: 'req-1', actor: ada, origin: 'http' }));

    const commands = new InMemoryCommandBus()
      .use(authorizationMiddleware({ authorizer, map, scope }))
      .register(IssueInvoice, { execute: async () => 'issued' });

    await commands.execute(new IssueInvoice(ada, 'customer-1'));

    expect(authorizer.checks).toEqual([
      { actor: ada, permission: billingPermissions['invoice.issue'], workTenantId: 'acme' },
    ]);
  });

  it('refuses with a 403 error carrying the reason code, before any transaction opens', async () => {
    const { commands, handled, unitOfWork } = application(new RecordingAuthorizer(new DenyAll('NO_MATCHING_ROLE')));

    const refusal = await commands.execute(new VoidInvoice(ada, 'inv-7')).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ForbiddenError);

    expect(refusal).toMatchObject({
      code: 'FORBIDDEN',
      reason: 'NO_MATCHING_ROLE',
      permissionId: 'billing:invoice.void',
    });

    expect(handled).toEqual([]);
    expect(unitOfWork.opened).toBe(0);
  });

  it('refuses the anonymous actor with a 401 error, without asking the authorizer', async () => {
    const { queries, authorizer } = application();

    const refusal = await queries.execute(new SearchInvoices(anonymousActor())).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(UnauthenticatedError);
    expect(refusal).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(authorizer.checks).toEqual([]);
  });

  it('lets anybody through a use case declared public, without asking', async () => {
    const { queries, authorizer, audit } = application(new RecordingAuthorizer(new DenyAll()));

    expect(await queries.execute(new GetCatalog())).toEqual(['book']);
    expect(authorizer.checks).toEqual([]);
    expect(audit).toEqual([]);
  });

  it('refuses a use case that declared nothing, as a programming error and not as a 403', async () => {
    const { commands, handled } = application();

    const failure = await commands.execute(new ArchiveInvoices(ada)).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UndeclaredUseCaseError);
    expect(failure).not.toHaveProperty('code');
    expect(String(failure)).toContain('requires(ArchiveInvoices, permission) or publicUseCase(ArchiveInvoices)');
    expect(handled).toEqual([]);
  });

  it('refuses a protected message sent without its actor, as a programming error', async () => {
    class ImportInvoices extends Command {}

    const loose = AuthorizationMap.of({
      ...requires(IssueInvoice, billingPermissions['invoice.issue']),
      type: ImportInvoices,
    });

    const bus = new InMemoryCommandBus()
      .use(authorizationMiddleware({ authorizer: new RecordingAuthorizer(), map: loose }))
      .register(ImportInvoices, { execute: async () => undefined });

    await expect(bus.execute(new ImportInvoices())).rejects.toBeInstanceOf(MissingActorError);
  });
});

describe('the audit hook of authorizationMiddleware', () => {
  it('reports every decision to the audit hook, allowed or refused', async () => {
    const allowing = application();
    const refusing = application(new RecordingAuthorizer(new DenyAll('NO_MATCHING_ROLE')));

    await allowing.commands.execute(new VoidInvoice(ada, 'inv-7'));
    await refusing.commands.execute(new VoidInvoice(ada, 'inv-7')).catch(() => undefined);
    await refusing.queries.execute(new SearchInvoices(anonymousActor())).catch(() => undefined);

    expect(allowing.audit).toEqual([
      {
        useCase: 'VoidInvoice',
        kind: 'command',
        actorId: 'ada',
        permissionId: 'billing:invoice.void',
        resource: { type: 'invoice', id: 'inv-7' },
        decision: { allowed: true },
      },
    ]);

    expect(refusing.audit.map((record) => record.decision)).toEqual([
      { allowed: false, reason: 'NO_MATCHING_ROLE' },
      { allowed: false, reason: 'ANONYMOUS' },
    ]);
  });

  it('refuses the command when the audit hook fails: no decision goes unrecorded', async () => {
    const guard = authorizationMiddleware({
      authorizer: new RecordingAuthorizer(),
      map,
      onDecision: async () => {
        throw new RangeError('audit store down');
      },
    });

    const bus = new InMemoryCommandBus().use(guard).register(IssueInvoice, { execute: async () => 'issued' });

    await expect(bus.execute(new IssueInvoice(ada, 'customer-1'))).rejects.toBeInstanceOf(RangeError);
  });
});

describe('AuthorizationMap', () => {
  it('lists what was declared, for generated documentation', () => {
    expect(map.declarations().map((declaration) => [declaration.type.name, declaration.access])).toEqual([
      ['IssueInvoice', 'protected'],
      ['VoidInvoice', 'protected'],
      ['SearchInvoices', 'protected'],
      ['GetCatalog', 'public'],
    ]);
  });

  it('refuses two declarations for one use case', () => {
    expect(() => AuthorizationMap.of(publicUseCase(GetCatalog), publicUseCase(GetCatalog))).toThrow(
      AuthorizationSetupError,
    );
  });

  it('merges the maps of several contexts', () => {
    const billing = AuthorizationMap.of(requires(IssueInvoice, billingPermissions['invoice.issue']));
    const catalog = AuthorizationMap.of(publicUseCase(GetCatalog));

    const merged = billing.merge(catalog);

    expect(merged.find(new GetCatalog())?.access).toBe('public');
    expect(merged.find(new IssueInvoice(ada, 'customer-1'))?.access).toBe('protected');
    expect(merged.find(new ArchiveInvoices(ada))).toBeUndefined();
  });

  it('only accepts a message carrying its actor as a protected use case', () => {
    // @ts-expect-error -- GetCatalog extends Query, not AuthorizedQuery: it has no actor to authorize
    const declaration = requires(GetCatalog, billingPermissions['invoice.read']);

    expect(declaration.access).toBe('protected');
  });
});
