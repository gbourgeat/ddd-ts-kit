import { aggregate } from './aggregate.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { ADAPTER, AGGREGATE, COMMAND, HANDLER, POLICY, QUERY_HANDLER, QUERY_HANDLER_SPEC, ROUTE } = PATHS;

export const AUTHZ_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'authz/in-application',
    name: 'a route that builds the actor, a handler asking the access port, an adapter scoped by tenant',
    expect: 'pass',
    files: project({
      [ROUTE]:
        "import { actorOf } from '@ddd-ts-kit/auth';\nimport type { Actor } from '@ddd-ts-kit/kernel';\n\nexport const issueInvoiceRoute = (principal: unknown): Actor => actorOf(principal);\n",
      ...handler(
        'export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<void> {\n    await this.access.authorize(command.actor, permission, command);\n  }\n}\n',
      ),
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  tenant(): string | undefined {\n    return this.actors.require().tenantId;\n  }\n}\n',
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'a role test in a route',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]:
        "export const issueInvoiceRoute = (context: Context): boolean => !context.principal.roles.includes('admin');\n",
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an authorizer imported by a route',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]: "import type { Authorizer } from '@ddd-ts-kit/auth';\n\nexport type IssueInvoiceRoute = Authorizer;\n",
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an adapter that decides and refuses',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        'export class InMemoryInvoiceRepository {\n  async find(request: Request): Promise<void> {\n    const decision = await this.authorizer.check(request);\n    if (!decision.allowed) {\n      throw new ForbiddenError(decision.reason);\n    }\n  }\n}\n',
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an aggregate that tests the roles of the actor',
    expect: { file: AGGREGATE },
    files: project(
      aggregate(
        "import type { Actor } from '@ddd-ts-kit/kernel';\nexport class Invoice {\n  issue(actor: Actor): boolean {\n    return actor.roles.includes('accountant');\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/in-application',
    name: 'a route resolving the session of the request',
    expect: 'pass',
    files: project({
      [ROUTE]:
        "import { resolveSession, sessionOf, type SessionAuthenticator } from '@ddd-ts-kit/auth';\nimport type { Session } from '@ddd-ts-kit/kernel';\n\nexport const issueInvoiceRoute = (authenticator: SessionAuthenticator, credential: string): Promise<Session> => resolveSession(authenticator, credential);\nexport { sessionOf };\n",
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an aggregate handed the session',
    expect: { file: AGGREGATE },
    files: project(
      aggregate(
        "import type { Session } from '@ddd-ts-kit/kernel';\nexport class Invoice {\n  issue(session: Session): string {\n    return session.id;\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an aggregate handed the execution context',
    expect: { file: AGGREGATE },
    files: project(
      aggregate(
        "import type { ExecutionContext } from '@ddd-ts-kit/kernel';\nexport class Invoice {\n  issue(context: ExecutionContext): string {\n    return context.correlationId;\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'the actor carried by the command, the ambient actor read by an adapter only',
    expect: 'pass',
    files: project({
      [COMMAND]:
        "import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceCommand extends AuthorizedCommand {\n  constructor(actor: Actor) {\n    super(actor);\n  }\n}\n",
      ...handler(
        'export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<string> {\n    return command.actor.id;\n  }\n}\n',
      ),
      [ADAPTER]:
        "import type { ActorContext } from '@ddd-ts-kit/kernel';\nexport class InMemoryInvoiceRepository {\n  constructor(private readonly actors: ActorContext) {}\n\n  tenant(): string | undefined {\n    return this.actors.require().tenantId;\n  }\n}\n",
    }),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'a handler reading the current actor',
    expect: { file: HANDLER },
    files: project(
      handler(
        "import type { ActorContext } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceHandler {\n  constructor(private readonly actors: ActorContext) {}\n\n  async execute(): Promise<string> {\n    return this.actors.require().id;\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'an aggregate handed the actor context',
    expect: { file: AGGREGATE },
    also: ['authz/in-application'],
    files: project(
      aggregate(
        "import type { ActorContext } from '@ddd-ts-kit/kernel';\nexport class Invoice {\n  issue(actors: ActorContext): string | undefined {\n    return actors.current()?.id;\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'the execution scope read by an adapter for audit columns and the tenant, an access scope in a handler',
    expect: 'pass',
    files: project({
      ...handler(
        'export class IssueInvoiceHandler {\n  async execute(query: InvoicesIssuedQuery): Promise<readonly string[]> {\n    const scope = await this.access.scopeOf(query.actor, permission);\n\n    return this.invoices.issuedWithin(scope);\n  }\n}\n',
      ),
      [ADAPTER]:
        "import { stampCreation, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';\nexport class InMemoryInvoiceRepository {\n  constructor(\n    private readonly scope: ExecutionScope,\n    private readonly clock: Clock,\n  ) {}\n\n  columns(): object {\n    return { ...stampCreation(this.scope, this.clock), ...tenantScopeOf(this.scope), correlationId: this.scope.require().correlationId };\n  }\n}\n",
    }),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'a handler handed the execution scope',
    expect: { file: HANDLER },
    files: project(
      handler(
        "import type { ExecutionScope } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceHandler {\n  constructor(private readonly scope: ExecutionScope) {}\n\n  async execute(): Promise<string | undefined> {\n    return this.scope.require().tenantId;\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'a handler reading a scope whose type is declared elsewhere',
    expect: { file: HANDLER },
    files: project(
      handler(
        'export class IssueInvoiceHandler {\n  async execute(): Promise<string | undefined> {\n    return this.dependencies.scope.current()?.correlationId;\n  }\n}\n',
      ),
    ),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'a handler stamping the audit columns itself',
    expect: { file: HANDLER },
    files: project(
      handler(
        "import { stampCreation } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<object> {\n    return stampCreation(command.context, this.clock);\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'authz/in-application',
    name: 'the access decorators, a policy and the access port in application/',
    expect: 'pass',
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(
        "import { Access } from '@ddd-ts-kit/auth';\nimport { CommandHandler } from '@ddd-ts-kit/kernel/declarations';\nimport { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';\n\n@CommandHandler(IssueInvoiceCommand, [Access])\nexport class IssueInvoiceHandler {}\n",
      ),
      [POLICY]: DECLARED.policy,
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'an access decorator imported by a route',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]:
        "import { Requires } from '@ddd-ts-kit/kernel/declarations';\n\nexport const issueInvoiceRoute = Requires;\n",
    }),
  },
  {
    ruleId: 'authz/in-application',
    name: 'the access port imported by an adapter',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        "import type { Access } from '@ddd-ts-kit/auth';\n\nexport class InMemoryInvoiceRepository {\n  constructor(private readonly access: Access) {}\n}\n",
    }),
  },
  {
    ruleId: 'authz/actor-explicit',
    name: 'a handler naming the execution scope in its dependency list',
    expect: { file: HANDLER },
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(
        "import { ExecutionScope } from '@ddd-ts-kit/kernel';\nimport { CommandHandler } from '@ddd-ts-kit/kernel/declarations';\nimport { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';\n\n@CommandHandler(IssueInvoiceCommand, [ExecutionScope])\nexport class IssueInvoiceHandler {}\n",
      ),
    }),
  },
  {
    ruleId: 'authz/fields-by-schema',
    name: 'a query that answers what its read model holds, the scope narrowing the rows',
    expect: 'pass',
    files: project({
      [QUERY_HANDLER]:
        "export class InvoicesIssuedHandler {\n  async execute(query: InvoicesIssuedQuery): Promise<readonly InvoiceLine[]> {\n    const scope = await this.access.scope(query.actor, permission, 'invoice');\n\n    return this.invoices.search(scope);\n  }\n}\n",
      [QUERY_HANDLER_SPEC]: SAMPLES.SPEC,
    }),
  },
  {
    ruleId: 'authz/fields-by-schema',
    name: 'a query that removes a field for the callers without a role',
    expect: { file: QUERY_HANDLER },
    files: project({
      [QUERY_HANDLER]:
        "export class InvoicesIssuedHandler {\n  async execute(query: InvoicesIssuedQuery): Promise<readonly InvoiceLine[]> {\n    const lines = await this.invoices.search(query.scope);\n\n    return query.actor.roles.includes('accountant') ? lines : lines.map(({ margin: _margin, ...line }) => line);\n  }\n}\n",
      [QUERY_HANDLER_SPEC]: SAMPLES.SPEC,
    }),
  },
];
