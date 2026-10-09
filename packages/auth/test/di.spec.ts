import { describe, expect, it } from 'vitest';
import { FixedClock, anonymousActor } from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  COMMAND_BUS,
  QUERY_BUS,
  WiringError,
  createApplication,
  createTestApplication,
  defineContextModule,
  fake,
  kernelModule,
  override,
} from '@ddd-ts-kit/di';
import {
  AuthorizationSetupError,
  ForbiddenError,
  RoleBasedAuthorizer,
  UnauthenticatedError,
  UndeclaredUseCaseError,
  type DecisionRecord,
} from '../src/index.js';
import { ACCESS, AUTHENTICATOR, AUTHORIZATION_MAP, AUTHORIZER, authorizationModule } from '../src/di.js';
import { AllowAll, FakeAuthenticator, RecordingAuthorizer } from '../src/testing.js';
import { Article, author, onlyAuthorEditsDraft, publishingPermissions, reader } from './support/articles.js';
import {
  ArchiveInvoices,
  GetCatalog,
  IssueInvoice,
  ListInvoices,
  VoidInvoice,
  ada,
  billingPermissions,
  bob,
} from './support/billing.js';

class IssueInvoiceHandler {
  async execute(command: IssueInvoice): Promise<string> {
    return `invoice for ${command.customerId}`;
  }
}

class VoidInvoiceHandler {
  async execute(): Promise<void> {}
}

const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.command(IssueInvoice).requires(billingPermissions['invoice.issue']).handledBy(IssueInvoiceHandler);
    builder
      .command(VoidInvoice)
      .requires(billingPermissions['invoice.void'], {
        resource: (command) => ({ type: 'invoice', id: command.invoiceId }),
        context: (command) => ({ tenantId: command.tenantId }),
      })
      .handledBy(VoidInvoiceHandler);
    builder
      .query(ListInvoices)
      .requires(billingPermissions['invoice.read'])
      .handledByFactory(() => ({ execute: async () => ['inv-1'] }));
    builder
      .query(GetCatalog)
      .public()
      .handledByFactory(() => ({ execute: async () => ['book'] }));
  },
});

const forgetfulModule = defineContextModule({
  name: 'archiving',
  register(builder) {
    builder.command(ArchiveInvoices).handledByFactory(() => ({ execute: async () => undefined }));
  },
});

const rbac = () =>
  new RoleBasedAuthorizer({
    roles: { accountant: [billingPermissions['invoice.issue'], billingPermissions['invoice.read']] },
  });

describe('authorizationModule', () => {
  it('enforces what the modules declared next to their handlers', async () => {
    const app = createApplication({
      modules: [kernelModule(), billingModule, authorizationModule({ authorizer: rbac() })],
      authorization: 'required',
    });
    const { resolve } = app;

    expect(await resolve(COMMAND_BUS).execute(new IssueInvoice(ada, 'customer-1'))).toBe('invoice for customer-1');
    await expect(resolve(COMMAND_BUS).execute(new IssueInvoice(bob, 'customer-1'))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(resolve(QUERY_BUS).execute(new ListInvoices(anonymousActor()))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(await resolve(QUERY_BUS).execute(new GetCatalog())).toEqual(['book']);
  });

  it('builds the authorization map from the declarations, for documentation and administration screens', () => {
    const app = createTestApplication({ modules: [billingModule, authorizationModule({ authorizer: rbac() })] });

    const declared = app.get(AUTHORIZATION_MAP).declarations();

    expect(declared.map((declaration) => [declaration.type.name, declaration.access])).toEqual([
      ['IssueInvoice', 'protected'],
      ['VoidInvoice', 'protected'],
      ['ListInvoices', 'protected'],
      ['GetCatalog', 'public'],
    ]);
    expect(app.describe().commands).toMatchObject([
      { message: 'IssueInvoice', access: 'protected', permission: 'billing:invoice.issue' },
      { message: 'VoidInvoice', access: 'protected', permission: 'billing:invoice.void' },
    ]);
    expect(app.describe().queries).toMatchObject([
      { message: 'ListInvoices', access: 'protected', permission: 'billing:invoice.read' },
      { message: 'GetCatalog', access: 'public' },
    ]);
  });

  it('passes the resource and the context of the declaration to the authorizer, and audits the decision', async () => {
    const authorizer = new RecordingAuthorizer();
    const audit: DecisionRecord[] = [];
    const app = createTestApplication({
      modules: [billingModule, authorizationModule({ authorizer, onDecision: (record) => void audit.push(record) })],
    });

    await app.commandBus.execute(new VoidInvoice(ada, 'inv-7', 'globex'));

    expect(authorizer.checks).toEqual([
      {
        actor: ada,
        permission: billingPermissions['invoice.void'],
        resource: { type: 'invoice', id: 'inv-7' },
        context: { tenantId: 'globex' },
      },
    ]);
    expect(audit).toMatchObject([{ useCase: 'VoidInvoice', actorId: 'ada', decision: { allowed: true } }]);
  });

  it('refuses at run time a use case that declared nothing, when wiring was left optional', async () => {
    const app = createTestApplication({
      modules: [billingModule, forgetfulModule, authorizationModule({ authorizer: new AllowAll() })],
    });

    await expect(app.commandBus.execute(new ArchiveInvoices(ada))).rejects.toBeInstanceOf(UndeclaredUseCaseError);
  });

  it('lets a test replace the authorizer with a fake', async () => {
    const authorizer = new RecordingAuthorizer();
    const app = createTestApplication({
      modules: [billingModule, authorizationModule({ authorizer: rbac() })],
      fakes: [fake(AUTHORIZER, authorizer)],
    });

    await app.commandBus.execute(new IssueInvoice(bob, 'customer-1'));

    expect(authorizer.checks).toHaveLength(1);
  });

  it('binds the authenticator when one is given, for the boundary to resolve', async () => {
    const authenticator = new FakeAuthenticator({ 'token-of-ada': ada });
    const withOne = createTestApplication({ modules: [authorizationModule({ authorizer: rbac(), authenticator })] });
    const without = createTestApplication({ modules: [authorizationModule({ authorizer: rbac() })] });

    expect(await withOne.get(AUTHENTICATOR).authenticate('token-of-ada')).toBe(ada);
    expect(() => without.get(AUTHENTICATOR)).toThrow(WiringError);
  });

  it('accepts factories resolving other bindings', async () => {
    const app = createApplication({
      modules: [kernelModule(), authorizationModule({ authorizer: () => new AllowAll(), authenticator: () => new FakeAuthenticator({}) })],
    });

    expect(app.resolve(AUTHORIZER)).toBeInstanceOf(AllowAll);
    expect(await app.resolve(AUTHENTICATOR).authenticate(undefined)).toEqual(anonymousActor());
  });

  it('gives handlers an Access made of the authorizer, the policies and the clock of the application', async () => {
    const app = createApplication({
      modules: [kernelModule(), authorizationModule({ authorizer: new AllowAll(), policies: [onlyAuthorEditsDraft] })],
      overrides: [override(CLOCK, new FixedClock(new Date('2026-05-01T12:00:00.000Z')))],
    });
    const access = app.resolve(ACCESS);
    const edit = publishingPermissions['article.edit'];
    const published = new Article('article-1', 'ada', new Date('2026-04-01T00:00:00.000Z'));

    await expect(access.authorize(author, edit, new Article('article-2', 'ada'))).resolves.toBeUndefined();
    await expect(access.authorize(reader, edit, new Article('article-2', 'ada'))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(access.authorize(author, edit, published)).rejects.toMatchObject({
      reason: 'article.only-author-edits-draft',
    });
  });

  it('refuses a use case protected by something that is not a permission, when the application starts', async () => {
    const sloppy = defineContextModule({
      name: 'sloppy',
      register(builder) {
        builder
          .command(ArchiveInvoices)
          .requires({ id: 'archive' })
          .handledByFactory(() => ({ execute: async () => undefined }));
      },
    });
    const app = createTestApplication({ modules: [sloppy, authorizationModule({ authorizer: new AllowAll() })] });

    expect(() => app.get(AUTHORIZATION_MAP)).toThrow(AuthorizationSetupError);
    await expect(app.start()).rejects.toBeInstanceOf(AuthorizationSetupError);
  });
});
