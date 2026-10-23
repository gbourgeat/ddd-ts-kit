**English** · [Français](bootstrap-with-well-designed-contexts.fr.md)

# Bootstrap with well-designed contexts

**Summary.** A generic subdomain is one every application of its kind needs and none wins
with: who the users are, which organisations they belong to, what they may do there. Designing
it again in each project costs weeks and is where the early mistakes of a project concentrate
(a password table, roles as free strings, a tenant id taken from the request). A preset of the
kit writes such a context whole, in the conventions of the kit, so the team spends its first
weeks on the core instead. This guide says what the `identity` preset writes, what it asks of
the stack and why, how it composes with each access model and with tenants, and what to do
once it is there. Which other contexts deserve a preset is weighed in
[Context presets](../proposals/context-presets.md).

## When to use one

Use a preset when the context is classified `generic` in `docs/architecture/contexts.md` (see
[Domain and subdomains](../concepts/domain-and-subdomains.md)) and its language is the one the
preset speaks. Do not use it for a context that only looks generic: the identity context of the
example ([`examples/scheduling`](../../examples/scheduling/src/contexts/identity/CONTEXT.md)) is
`supporting`, since its delegations are given by a practitioner to an assistant on one desk,
and practices live in a time zone. A preset there would have to be bent until it is no longer
the preset; the generators are the better start.

A preset is written once. From then on its files are the code of the project: nothing in the
config remembers it, and changing them is changing any other context.

## Writing it

```bash
npx ddd-ts-kit init --preset identity                     # declares the context identity, generic
npx ddd-ts-kit generate context people --preset identity  # into an existing project, under another name
```

On `init`, the preset writes the context of its name, `identity`, declared `generic` unless a
`--context identity:<classification>` says otherwise. On `generate context`, it writes into the
context named, with the classification and purpose of the preset unless `--classification` or
`--purpose` say otherwise. Either way it runs the generators of the kit for what they wire outside
the context (the tables of the platform, the published language, the registries, the audited
events), then lays out the files those generators keep adding to.

A project holds one context written from a preset of a kind: two identity contexts would declare
the same integration events and tables in the files of the platform (the audited events, the
schema), which do not compile together. `generate context --preset` refuses a second one, naming
the context that holds the first, and `init` writes a preset named twice once.

The result is green as it is, the whole `npm run verify` right after the install: no finding of
`check`, ESLint, dependency-cruiser and knip, format clean, typed, the contracts up to date, and
its specs pass over the coverage floors, unit and integration (the adapters of the ORM against
PostgreSQL in process). Its contracts are written from the running application, which only the
project can build: `init --preset` marks `openapi/openapi.yaml`, `docs/integration/asyncapi.yaml`
and `docs/integration/event-catalog.md` to be written (`x-ddd-ts-kit-pending`), the first `verify`
writes them, and they are committed with the project; a pipeline (`CI` set) fails on a contract
never written. A preset generated into a project that exists adds its routes and events to
contracts already written: run `npm run docs:generate`, as after any generator that adds one. The
end-to-end specs prove it on four stacks: roles on Drizzle and Zod; relationships on Knex and
class-validator with tenants and Keycloak; attribute policies on Fastify with tenants and a JWT
verifier (`packages/cli/test/e2e/preset-identity.spec.ts`); and generated into a project that
exists and decides with OpenFGA (`preset-identity-generated.spec.ts`).

## What it writes

| Part | What |
|---|---|
| Accounts | an account per person, under the subject their identity provider gives them (`actor.id`): provisioned at the first sign-in from what their token says (`PUT /accounts/me`), refreshed at each later one, deactivated by its owner (`POST /accounts/me/deactivation`). No password, no secret of the provider. The email address is always the one of the token, and one the provider verified (`email_verified`, read as the actor attribute `emailVerified`; `EMAIL_NOT_VERIFIED` otherwise), since invitations are matched on it. A deactivated account leaves every organisation and ends every delegation in the same unit of work; the last owner of an organisation appoints another owner first (`LAST_OWNER`) |
| Organisations | opened under a slug that is their identity for good (`POST /organisations`); the opener is the first owner. With tenants, an organisation is a tenant and its slug the tenant id |
| Members | one role each, from the vocabulary `MemberRole` (`owner`, `admin`, `member`); what a role grants is one table, `RoleRightsService` (`PUT /organisations/:organisationId/members/:accountId/role`, `DELETE` of the member). Nobody changes their own role (`OWN_ROLE`), and nobody appoints, invites, changes or removes anyone above their own role (`ABOVE_OWN_ROLE`, `OWNERS_ONLY` for an owner). An organisation keeps one owner at least: each change of a member saves the organisation with it, so that its version orders the changes of its owners and two owners who remove each other at once cannot both commit |
| Invitations | issued to an email address in a role for seven days (`POST /organisations/:organisationId/invitations`); the token is answered once and only its SHA-256 digest is kept; accepted or declined signed in, with the address it was sent to (`POST /invitations/acceptance`, `/invitations/declination`); revoked by who may invite |
| Delegations | a member lends some rights of their role to another member for ninety days at most (`POST /organisations/:organisationId/delegations`, `DELETE` to revoke); never more than the role of the delegator, never what was lent to them, never the power to act above the delegate's own role; ended when either member leaves or the delegator changes role. A change decided under a delegation names it in its fact (`delegationId` of `member.role-changed`, `member.removed` and of the issued invitation) |
| Search | the members of an organisation, paged, narrowed to what the actor may read (`GET /organisations/:organisationId/members`) |
| Authorization | `identityPermissions`, seven policies over `OrganisationRights` (the rights of the actor in one organisation: their role and what active delegations lend them) |
| Published language | `organisation.opened`, `member.joined`, `member.role-changed`, `member.removed`, `delegation.granted`, `delegation.revoked`, `account.deactivated`, through the outbox |
| Identity provider | the port `IdentityProviderAdmin`, kept in line by four consumers of the published facts, delivered at least once (organisation known, member added or removed, account disabled), with an in-memory fake and `KeycloakIdentityProviderAdmin`, a recipe for Keycloak 26 or later |
| Adapters | Knex or Drizzle repositories, mappers, tables and the search reader, each with its contract spec |
| Tests | builders, fakes, unit specs of the model and of every handler and controller, contract specs of the repositories, the spec of the Keycloak adapter against a local HTTP server |
| Documentation | the purpose, the classification, the glossary and a `## Design` section in `CONTEXT.md`; with tenants, a decision record |

## What it asks of the stack

The preset is written for the defaults of `init` and their nearest variants. Another stack is
refused before anything is written, with the flag that would fit:

| Key | Accepted | Why |
|---|---|---|
| `stack.style` | `declared` | the use cases, policies and adapters declare themselves; an explicit module would be a second copy of the context to keep |
| `stack.dependencies` | `signature` | the classes state what they need by their constructor |
| `stack.refusals` | `named`, `factories` | named: one class per refusal, its code read from `<context>.codes.ts`; factories: the static factories of one class per concept |
| `stack.valueObjects` | `throwing` | the value objects refuse an invalid value when built |
| `stack.routes` | `controllers` | one controller class per route |
| `stack.orm` | `knex`, `drizzle` | the two adapters written; Prisma and TypeORM are not |
| `stack.validation` | `zod`, `class-validator` | the two families of request schemas written |
| `stack.schemas` | `shared`, `per-route` | shared: the identifier answers are the `Accepted` of `@ddd-ts-kit/http` and the token of an invitation one schema of `presentation/http/shared/`; per route: each route keeps its own |
| `stack.http` | `express`, `fastify` | NestJS routes are written another way |
| `stack.authn` | `jwt`, `keycloak` | an account is the subject of a token: without a verifier every caller is anonymous and the context would serve nobody |
| `stack.database` | `postgres` | the tables keep one current membership per account with a partial unique index (`where removed_at is null`), which MySQL has not |

Supporting another value is writing the variant of the files it changes
(`*.knex.ts.tpl` beside `*.drizzle.ts.tpl` under `packages/cli/templates/presets/identity/`, several
variants in a row when a file depends on several keys: `*.class-validator.per-route.ts.tpl`), not
a change of the model.

## Access models and tenants

Every use case requires a permission of `identityPermissions`, and every signed-in person holds
them whatever `--authz` says: the preset writes the grant `'identity:*'` into
`platform/auth/authorization/signed-in-grants.ts` and wraps the model of `createAuthorizer` in
`SignedInGrantsAuthorizer` of `@ddd-ts-kit/auth`, which answers those grants before the model.
Systems, services and anonymous callers get nothing from it. Inside an organisation, the
policies of the context decide, on the rights the actor holds there. So the same files serve:

| `--authz` | What decides inside an organisation | What the other contexts do with the events |
|---|---|---|
| `rbac` | the policies, on the role in the organisation | nothing to do: roles of the token stay the platform roles |
| `abac` | the policies; the rules of `attribute-policies.ts` still decide the other contexts | read the role as an attribute if a rule needs it |
| `rebac` | the policies | write the tuples of their own model from `member.joined`, `member.role-changed`, `member.removed`, `delegation.*` |
| OpenFGA | the policies | the same tuples, written to OpenFGA by `@ddd-ts-kit/openfga` |
| `custom` | the policies | as the adapter of the project needs |

A `createAuthorizer` the team has rewritten is left alone; the generator then says, as a next
step, how to wrap it.

With `--tenancy shared-table`, an organisation is a tenant: the publishers give each event the
organisation as its tenant, so the consumers of other contexts run in it. The tables of the
identity context belong to no tenant, since they decide who belongs to which: they are the
control plane of the tenants, read across them under a decision record the preset writes
(`docs/adr/NNNN-identity-is-the-control-plane-of-the-tenants.md`), the suppressions of
`tenancy/scoped-statement` pointing to it. See [Multitenancy](../concepts/multitenancy.md).

The token says which organisations a person belongs to, so that every other context knows its
tenant from it. With `--authn keycloak` the preset sets `tenantClaim: 'organization'` in
`createAuthenticator`: Keycloak writes the `organization` claim of the organizations the
provider adapter keeps in line (the client scope `organization` added to the client). A person of
one organisation works in it on every request; a person of several holds them as the `tenants`
attribute, and each request names the one it works in with `x-tenant-id` (refused with 403 if
they are not a member of it, `tenantFromHeader` then `tenantFromClaim` in `resolveTenant`).
Removed from an organisation, they lose it at their next token, and the identity context already
refuses them its use cases. With `--authn jwt` the preset leaves a next step: map the claim your
provider writes (`tenantClaim` when it is a list or an object keyed by organisation, `toActor`
otherwise).

## The identity provider

![A person signs in at the identity provider, whose token gives the API edge the actor and its tenants; the identity context decides on accounts, organisations, members, invitations and delegations; its facts leave through the outbox, four consumers bring the provider in line through IdentityProviderAdmin at least once, and the other contexts build their own tuples and tenants from the same facts](../assets/diagrams/bootstrap-with-well-designed-contexts-identity-loop.svg)

The provider authenticates, the context authorizes ([Identity](../tools/identity.md)). The
provider follows the decisions of the context through four consumers of its own published facts
(`application/integration/handlers/`): delivered through the outbox, at least once, so a provider
that is down when a member is removed or an account deactivated is asked again by the relay or
the broker until it answers, and the revocation is never lost. They arrive in no guaranteed
order, so each consumer brings the provider in line with what the context holds now (a late
retry of `member.joined` for a member removed since takes them out again), and every method of
the port is idempotent.

`KeycloakIdentityProviderAdmin` is a recipe for the administration API of Keycloak 26 or later,
the realm having organizations enabled, as a confidential client holding the roles
`manage-users` and `manage-realm` of `realm-management` (the organizations endpoints ask the
second). It reads `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `IDENTITY_PROVIDER_ADMIN_CLIENT_ID` and
`IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET` when a call is made, so a project that does not use it
starts without them.

Another provider (Zitadel, Auth0, Entra ID) is another adapter of the same port: four methods
(`openOrganisation`, `addMember`, `removeMember`, `disableAccount`), its spec run against a local
HTTP server as the Keycloak one is, declared `@Adapter(IdentityProviderAdmin)` in place of the
Keycloak one. A provider that needs nothing from the application gets an adapter whose methods
do nothing, which its class comment says.

The Keycloak adapter is specified against the paths and bodies of the Keycloak 26 documentation
by a local server; the pipeline of the kit does not run it against a real Keycloak. It was run
once by hand against Keycloak 26.8.0 (2026-10-13): every method, each twice, did what it says,
a disabled user kept their profile, and that run corrected the search of an organization, which
Keycloak finds by name and not by alias, so the adapter reads its pages. Before relying on it,
run it once against your realm: start Keycloak (`npm run infra:up` with `--authn
keycloak`), enable organizations in the realm, create the confidential client with the two roles,
then call each method from a script and read the result in the administration console (the
organization and its members, the user disabled with the attributes of their profile kept).

## After it is written

1. Read `## Design` of its `CONTEXT.md`, then the decision record if there is one.
2. Adjust the vocabulary `MemberRole` and the table of `RoleRightsService` to the roles the
   business names; the policies read rights, not roles, and do not change.
3. Deliver the invitation token: the answer of the route holds it once, and only its digest is
   kept, so no event carries it. The client sends the link; or, for the application to write
   the email itself, `InviteMemberHandler` hands the token to a port of yours (an email
   gateway) where it issues it.
4. Give the other contexts what they need from the published language, through
   `generate integration-handler`.
5. Run `npm run verify` and commit the context as one change: it is green as written.

## See also

- [Context presets](../proposals/context-presets.md): which other contexts deserve one
- [Choosing access control](choosing-access-control.md)
- [Domain and subdomains](../concepts/domain-and-subdomains.md)
- [Which command, when](commands.md)
