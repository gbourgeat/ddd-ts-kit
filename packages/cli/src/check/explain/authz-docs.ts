import type { RuleDoc } from '../model/rule-doc.js';

export const AUTHZ_DOCS: Readonly<Record<string, RuleDoc>> = {
  'authz/declared': {
    why: 'A use case nobody thought about is reachable by everybody. Declaring the permission next to the registration, or declaring the use case public, makes the decision visible in review and lets the bus middleware refuse everything else. The same holds for a route: its security is part of the contract, not a default. The route type enforces it already (`defineRoute` does not compile without `security` and refuses an empty list); this rule stays as the net for a definition built loosely, from an untyped object or a cast. On a message class, @Requires(...) or @Public() of @ddd-ts-kit/kernel/declarations is the declaration, in any project; in the declared style there is no registration to read, so a command or query class carrying neither is reported.',
    bad: `builder.command(VoidInvoiceCommand).handledBy(VoidInvoiceHandler, [InvoiceRepository]);
defineRoute({ method: 'POST', path: '/invoices/:id/void' }, handler);
// application/commands/void-invoice/void-invoice.command.ts, declared style
export class VoidInvoiceCommand extends AuthorizedCommand<void> {}`,
    good: `builder.command(VoidInvoiceCommand).requires(billingPermissions['invoice.void']).handledBy(VoidInvoiceHandler, [InvoiceRepository]);
builder.query(GetCatalogQuery).public().handledBy(GetCatalogHandler, [CatalogReader]);
defineRoute({ method: 'POST', path: '/invoices/:id/void', security: ['bearer'] }, handler);
// application/commands/void-invoice/void-invoice.command.ts, declared style
@Requires(billingPermissions['invoice.void'])
export class VoidInvoiceCommand extends AuthorizedCommand<void> {}`,
  },
  'authz/in-application': {
    why: 'A right decided in a route is skipped by every other entry point: a consumer, a job, another route. Decided in an adapter or in an aggregate, it is invisible and tied to one authorization model. In the application layer, behind the Authorizer port, every right is declared once, tested once, and changing from roles to policies or relationships changes an adapter only. A route keeps the request glue of @ddd-ts-kit/auth (actorOf, sessionOf, resolveSession, a SessionAuthenticator); the domain sees neither the Actor, the Session nor the ExecutionContext. The access decorators (Requires, Public, Policy of @ddd-ts-kit/kernel/declarations) and the access ports of @ddd-ts-kit/auth (Access, PolicyAccess) are how the application layer says it: they are imported in application/ and refused in presentation/, infrastructure/ and domain/.',
    bad: `// presentation/http/void-invoice.route.ts
if (!context.principal.roles.includes('admin')) return { status: 403 };
// presentation/http/void-invoice.route.ts
import { Requires } from '@ddd-ts-kit/kernel/declarations';`,
    good: `// presentation/http/void-invoice.route.ts
await commandBus.execute(new VoidInvoiceCommand(actorOf(context.principal), params.invoiceId));
// application/commands/void-invoice/void-invoice.handler.ts
await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {}`,
  },
  'authz/actor-explicit': {
    why: 'A handler that reads "the current user" from an ambient context depends on something no signature shows: a consumer or a job that forgot to set it fails at run time, and a test has to set a global. With the actor as data of the command, the use case says who acts, and any caller can send it. The ExecutionScope port (and ActorContext, a view of it) is named and read by infrastructure and the platform alone, as a type or as a value in a dependency list, for audit columns, tenant scoping and correlation: stampCreation, stampUpdate and tenantScopeOf belong in a repository adapter.',
    bad: `// application/commands/void-invoice/void-invoice.handler.ts
@CommandHandler(VoidInvoiceCommand, [InvoiceRepository, ExecutionScope])
const actor = this.actors.require();
const { tenantId } = this.scope.require();
const stamp = stampCreation(this.scope, this.clock);`,
    good: `// application/commands/void-invoice/void-invoice.command.ts
export class VoidInvoiceCommand extends AuthorizedCommand {}
// application/commands/void-invoice/void-invoice.handler.ts
const { actor } = command;
// infrastructure/persistence/drizzle-invoice.repository.ts
const row = { ...toRow(invoice), ...stampCreation(this.scope, this.clock), ...tenantScopeOf(this.scope) };`,
  },
};
