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
if (!context.principal.roles.includes('admin')) {
  return { status: 403 };
}
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
  'authz/granted': {
    why: "In a project whose rights are roles (stack.authz rbac), a permission does two things: a use case requires it, and a role holds it. The generator declares the first; the grant lives in the roles of the platform. The super-admin holds the wildcard `*`, so a permission no role names is reachable by administrators only, the checks stay green and the people the use case was written for are refused at run time. It fails closed, which is safe, but silently. Judged: every key of every `definePermissions` set of a context is named in `<platformDir>/auth/roles/roles.ts` or in what every signed-in person holds (`signed-in-grants.ts`, which a context preset writes), by the entry of its set (`billingPermissions['invoice.issue']`), by its id (`'billing:invoice.issue'`) or by the wildcard of its context (`'billing:*'`); the bare `*` does not count, and a grant to `Role.System` does. A permission meant for administrators only is granted to `Role.Admin` by name, so that the intent is read in review. Silent when the rights are attributes, relationships or an authorizer of the project, and when the platform has no roles file. A warning: it fails closed.",
    bad: `// contexts/billing/application/authorization/billing.permissions.ts
export const billingPermissions = definePermissions('billing', {
  'invoice.void': { description: 'Void invoice' },
});
// platform/auth/roles/roles.ts
export const roles = { [Role.Admin]: ['*'] };`,
    good: `// platform/auth/roles/roles.ts
export const roles = {
  [Role.Admin]: ['*'],
  [Role.Accountant]: [billingPermissions['invoice.void']],
};
// or, when generating the use case: --permission invoice.void --grant accountant`,
  },
  'authz/scope-narrows': {
    why: "Every signed-in person holds the grants of SignedInGrantsAuthorizer, whatever the model of the project: it answers them before it asks the model, for a check and for a listing alike, and the listing is `all`. A handler that narrows a search by the scope of such a permission reads every element for every person who signed in, and the tests of the handler stay green. It is the shortcut taken when the model refuses a search with no element to check (relationships answer RESOURCE_REQUIRED): the grant lets the query past the bus, and the scope no longer narrows anything. The model decides instead: under relationships, the requirement names an enclosing resource (`{ type: 'context', id: '<context>' }` as the generator writes it, or the tenant of the actor) and Access.scope answers the ids of the elements. Judged: the second argument of a `.scope(` call in a context, the entry of a permission set written in place or held in a constant or a field of the same file, against the grants of `<platformDir>/auth/authorization/signed-in-grants.ts` and those given to every `new SignedInGrantsAuthorizer({ grants })` as an array literal or a constant declared as one (an entry, an id, the wildcard of a context, the bare `*`). What it cannot read is reported, never taken as safe: grants built by a call or a spread, a permission handed in to a `.scope(` call on `access`. What it cannot see at all: a permission every person holds through the model itself (a role every account has, a relation every member of a tenant has), and a search that does not ask Access.scope. Those are decisions of the model: the specs of the search prove them, with the real authorizer, an element of another owner absent. A warning: a search every signed-in person may run on every element is legitimate, its scope then says nothing.",
    bad: `// platform/auth/authorization/signed-in-grants.ts
export const signedInGrants: readonly Grant[] = [docsPermissions['document.search']];
// contexts/docs/application/queries/search-documents/search-documents.handler.ts
const scope = await this.access.scope(query.actor, docsPermissions['document.search'], 'document');`,
    good: `// contexts/docs/application/queries/search-documents/search-documents.query.ts
@Requires(docsPermissions['document.search'], { resource: () => ({ type: 'context', id: 'docs' }) })
export class SearchDocumentsQuery extends AuthorizedQuery<SearchDocumentsResult> {}
// contexts/docs/application/queries/search-documents/search-documents.handler.ts
const scope = await this.access.scope(query.actor, docsPermissions['document.search'], 'document');
// { kind: 'ids', ids: [...] }: the documents the actor reaches, an empty page for one who reaches none`,
  },
  'authz/policy-asked': {
    why: 'The bus checks the permission of a use case before its handler runs, with the identifier of the element at most: it cannot read the element. A policy is the part of the right that needs the element (only the issuer, not after closing), and it is evaluated only when the handler asks Access once the element is loaded. A handler that forgets to ask leaves the policy declared, tested and never applied, and nothing at run time says so. Judged: for every permission refined by a policy (@Policy or definePolicy in application/authorization/), the handlers in the folder of each command or query that requires it (@Requires, .requires(...) or requires(X, ...)) call authorize, decide or decideOn and name that permission in their code. The TODO(domain) the generator leaves in such a handler, naming the permission, is accepted, and so is a TODO(review) that names it: `ddd-ts-kit todo` lists both, and until it is done the authorization module refuses the result of the handler at run time (PolicyNotAskedError).',
    bad: `// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {}
// application/commands/void-invoice/void-invoice.handler.ts
const invoice = await this.invoices.get(command.invoiceId);
invoice.void(this.clock.now());`,
    good: `// application/commands/void-invoice/void-invoice.handler.ts
const invoice = await this.invoices.get(command.invoiceId);
await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
invoice.void(this.clock.now());`,
  },
  'authz/actor-explicit': {
    why: 'A handler that reads "the current user" from an ambient context depends on something no signature shows: a consumer or a job that forgot to set it fails at run time, and a test has to set a global. With the actor as data of the command, the use case says who acts, and any caller can send it. The ExecutionScope port (and ActorContext, a view of it) is named and read by infrastructure and the platform alone, as a type or as a value in a dependency list, for audit columns, tenant scoping and correlation: stampCreation, stampUpdate and tenantScopeOf belong in a repository adapter.',
    bad: `// application/commands/void-invoice/void-invoice.handler.ts
constructor(private readonly invoices: InvoiceRepository, private readonly scope: ExecutionScope) {}
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
  'authz/fields-by-schema': {
    why: 'A query that removes a field for the callers without a role answers one way in JSON and is forgotten in the CSV export, the XML of a partner and the form of the front end, and nobody reading the contract knows the field may be missing. Marked on the response schema with withFieldAccess of @ddd-ts-kit/http, the field is reserved to a permission or a policy once: the pipeline leaves it out of every representation for an actor who may not read it, refuses it in a request body from one who may not set it, the contract says so with x-field-access, and a form described by the server shows it read-only or not at all. Which rows the actor may read stays the access scope of the query. Judged: a test on the roles (roles.includes, some, every, find, indexOf), a comparison with a role, or isAdmin, in a file under application/queries/ of a context.',
    bad: `// application/queries/get-appointment/get-appointment.handler.ts
const row = await this.appointments.findById(query.appointmentId);
return query.actor.roles.includes('practitioner') ? row : { ...row, internalNote: undefined };`,
    good: `// application/queries/get-appointment/get-appointment.handler.ts
return this.appointments.findById(query.appointmentId);
// presentation/http/appointments/get-appointment/get-appointment.controller.ts
const answer = withFieldAccess(classSchema(GetAppointmentAnswer), {
  internalNote: { read: { permission: schedulingPermissions['appointment.note.read'] } },
});`,
  },
};
