import { authzActorExplicit } from '../../src/rules/authz-actor-explicit';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const MODULE = `${BILLING}/billing.module.ts`;
const ROUTE = `${BILLING}/presentation/http/void-invoice.route.ts`;
const HANDLER = `${BILLING}/application/commands/void-invoice/void-invoice.handler.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;
const SPEC = `${BILLING}/test/unit/void-invoice.handler.spec.ts`;

ruleTester.run('authz-actor-explicit', authzActorExplicit, {
  valid: [
    at(
      HANDLER,
      "import type { Actor } from '@ddd-ts-kit/kernel';\nclass VoidInvoiceHandler { constructor(private readonly invoices: InvoiceRepository, private readonly access: Access) {} async execute(command: VoidInvoice) { return command.actor.id; } }",
    ),
    at(
      ADAPTER,
      "import type { ActorContext } from '@ddd-ts-kit/kernel';\nclass Repo { constructor(private readonly actors: ActorContext) {} }",
    ),
    at(
      ADAPTER,
      "import { stampCreation, tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';\nclass Repo { constructor(private readonly scope: ExecutionScope) {} row() { return { ...stampCreation(this.scope, clock), ...tenantScopeOf(this.scope), id: this.scope.require().correlationId }; } }",
    ),
    at(ROUTE, "import { ActorContext, ExecutionScope } from '@ddd-ts-kit/kernel';"),
    at(
      MODULE,
      "import { ActorContext, ExecutionScope } from '@ddd-ts-kit/kernel';\nbuilder.bind(InvoiceRepository).toClass(Repo, [ActorContext, ExecutionScope]);",
    ),
    at(
      'src/platform/http/scope.ts',
      "import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';\nconst context = scope.current();",
    ),
    at(
      SPEC,
      "import { FixedActorContext, FixedExecutionScope, type ActorContext, type ExecutionScope } from '@ddd-ts-kit/kernel';\nconst context = scope.require();",
    ),
    at(HANDLER, 'const context = options.actorContext;'),
    at(
      HANDLER,
      'class H { async execute(query: SearchInvoices) { const scope = await this.access.scopeOf(query.actor, permission); return this.invoices.within(scope); } }',
    ),
    at(HANDLER, 'function within(scope: AccessScope) { return scope.current(); }'),
    at(
      HANDLER,
      'class H { constructor(private readonly scope: ProjectScope) {} execute() { return this.scope.require(); } }',
    ),
    at(
      HANDLER,
      'const module = loader.require();\nconst page = cursor.current();\nconst value = scope.current(position);',
    ),
    at(
      AGGREGATE,
      'class Invoice { stampUpdate(at: Date): void { this.touch(at); } revise(at: Date): void { this.stampUpdate(at); } }',
    ),
  ],
  invalid: [
    {
      ...at(HANDLER, "import type { ActorContext } from '@ddd-ts-kit/kernel';"),
      errors: [{ messageId: 'imported', data: { name: 'ActorContext', layer: 'application' } }],
    },
    {
      ...at(HANDLER, "import { ActorContext as Current } from '@ddd-ts-kit/kernel';"),
      errors: [{ messageId: 'imported', data: { name: 'ActorContext', layer: 'application' } }],
    },
    {
      ...at(AGGREGATE, "import { AsyncLocalStorage } from 'node:async_hooks';"),
      errors: [{ messageId: 'imported', data: { name: 'AsyncLocalStorage', layer: 'domain' } }],
    },
    { ...at(HANDLER, "export { ScopedActorContext } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'imported' }] },
    {
      ...at(HANDLER, 'const storage = new hooks.AsyncLocalStorage<Actor>();'),
      errors: [{ messageId: 'used', data: { name: 'AsyncLocalStorage', layer: 'application' } }],
    },
    {
      ...at(HANDLER, 'class H { constructor(private readonly actors: kernel.ActorContext) {} }'),
      errors: [{ messageId: 'injected' }, { messageId: 'used' }],
    },
    {
      ...at(
        HANDLER,
        'class VoidInvoiceHandler { constructor(private readonly invoices: InvoiceRepository, private readonly actors: ActorContext) {} }',
      ),
      errors: [{ messageId: 'injected', data: { className: 'VoidInvoiceHandler', port: 'ActorContext' } }],
    },
    {
      ...at(
        `${BILLING}/domain/services/numbering.service.ts`,
        'class Numbering { constructor(actors: ActorContext) {} }',
      ),
      errors: [{ messageId: 'injected' }],
    },
    {
      ...at(HANDLER, "import type { ExecutionScope } from '@ddd-ts-kit/kernel';"),
      errors: [{ messageId: 'imported', data: { name: 'ExecutionScope', layer: 'application' } }],
    },
    {
      ...at(
        HANDLER,
        "import { ExecutionScope } from '@ddd-ts-kit/kernel';\nimport { AsyncLocalStorageExecutionScope, ScopedActorContext } from '@ddd-ts-kit/kernel';",
      ),
      errors: [{ messageId: 'imported' }, { messageId: 'imported' }, { messageId: 'imported' }],
    },
    {
      ...at(
        HANDLER,
        "import { ExecutionScope } from '@ddd-ts-kit/kernel';\nimport { CommandHandler } from '@ddd-ts-kit/kernel/declarations';\n@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, ExecutionScope])\nexport class IssueInvoiceHandler {}",
      ),
      errors: [{ messageId: 'imported', data: { name: 'ExecutionScope', layer: 'application' } }],
    },
    {
      ...at(AGGREGATE, 'function tenant(scope: kernel.ExecutionScope) { return scope; }'),
      errors: [{ messageId: 'used', data: { name: 'ExecutionScope', layer: 'domain' } }],
    },
    {
      ...at(
        HANDLER,
        'class H { constructor(private readonly scope: ExecutionScope) {} execute() { return this.scope.require().tenantId; } }',
      ),
      errors: [
        { messageId: 'injected', data: { className: 'H', port: 'ExecutionScope' } },
        { messageId: 'read', data: { read: 'this.scope.require', layer: 'application' } },
      ],
    },
    {
      ...at(HANDLER, 'class H { execute() { return this.dependencies.scope.current()?.correlationId; } }'),
      errors: [{ messageId: 'read', data: { read: 'this.dependencies.scope.current', layer: 'application' } }],
    },
    {
      ...at(
        HANDLER,
        'const actor = this.#actors.require();\nconst context = executionScope.current();\nconst other = this.actorContext.current();',
      ),
      errors: [{ messageId: 'read' }, { messageId: 'read' }, { messageId: 'read' }],
    },
    {
      ...at(AGGREGATE, 'function who(ambient: ActorContext) { return ambient.current(); }'),
      errors: [{ messageId: 'read', data: { read: 'ambient.current', layer: 'domain' } }],
    },
    {
      ...at(HANDLER, "import { stampCreation, stampUpdate as touch, tenantScopeOf } from '@ddd-ts-kit/kernel';"),
      errors: [
        { messageId: 'helper', data: { name: 'stampCreation', layer: 'application' } },
        { messageId: 'helper', data: { name: 'stampUpdate', layer: 'application' } },
        { messageId: 'helper', data: { name: 'tenantScopeOf', layer: 'application' } },
      ],
    },
    {
      ...at(
        AGGREGATE,
        "import * as kernel from '@ddd-ts-kit/kernel';\nconst stamp = kernel.stampCreation(context, clock);",
      ),
      errors: [{ messageId: 'helper', data: { name: 'stampCreation', layer: 'domain' } }],
    },
  ],
});
