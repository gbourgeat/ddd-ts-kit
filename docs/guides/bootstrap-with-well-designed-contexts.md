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
schema), which do not compile together.

The result is green as it is: no finding of `check`, lint and format clean, typed, and its
specs pass, unit and integration (the adapters of the ORM against PostgreSQL in process). The
end-to-end spec `packages/cli/test/e2e/preset-identity.spec.ts` proves it on two stacks.

## What it writes

| Part | What |
|---|---|
| Accounts | an account per person, under the subject their identity provider gives them (`actor.id`): provisioned at the first sign-in from what their token says (`PUT /accounts/me`), refreshed at each later one, deactivated by its owner (`POST /accounts/me/deactivation`). No password, no secret of the provider. The email address is always the one of the token |
| Organisations | opened under a slug that is their identity for good (`POST /organisations`); the opener is the first owner. With tenants, an organisation is a tenant and its slug the tenant id |
| Members | one role each, from the vocabulary `MemberRole` (`owner`, `admin`, `member`); what a role grants is one table, `RoleRightsService`. An organisation keeps one owner at least, and only an owner appoints one (`PUT /organisations/:organisationId/members/:accountId/role`, `DELETE` of the member) |
| Invitations | issued to an email address in a role for seven days (`POST /organisations/:organisationId/invitations`); the token is answered once and only its SHA-256 digest is kept; accepted or declined signed in, with the address it was sent to (`POST /invitations/acceptance`, `/invitations/declination`); revoked by who may invite |
| Delegations | a member lends some rights of their role to another member for ninety days at most (`POST /organisations/:organisationId/delegations`, `DELETE` to revoke); never more than the role of the delegator, never what was lent to them; ended when either member leaves or the delegator changes role |
| Search | the members of an organisation, paged, narrowed to what the actor may read (`GET /organisations/:organisationId/members`) |
| Authorization | `identityPermissions`, seven policies over `OrganisationRights` (the rights of the actor in one organisation: their role and what active delegations lend them) |
| Published language | `organisation.opened`, `member.joined`, `member.role-changed`, `member.removed`, `delegation.granted`, `delegation.revoked`, `account.deactivated`, through the outbox |
| Identity provider | the port `IdentityProviderAdmin`, told after each commit (organisation known, member added or removed, account disabled), with an in-memory fake and `KeycloakIdentityProviderAdmin` for Keycloak 26 or later |
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
| `stack.refusals` | `factories` | the refusals are static factories of one class per concept |
| `stack.valueObjects` | `throwing` | the value objects refuse an invalid value when built |
| `stack.routes` | `controllers` | one controller class per route |
| `stack.orm` | `knex`, `drizzle` | the two adapters written; Prisma and TypeORM are not |
| `stack.validation` | `zod`, `class-validator` | the two families of request schemas written |
| `stack.http` | `express`, `fastify` | NestJS routes are written another way |

Supporting another value is writing the variant of the files it changes
(`*.knex.ts.tpl` beside `*.drizzle.ts.tpl` under `packages/cli/templates/presets/identity/`), not
a change of the model.

## Access models and tenants

Every use case requires a permission of `identityPermissions`, and every signed-in person holds
them whatever `--authz` says: the preset writes the grant `'identity:*'` into
`platform/auth/signed-in-grants.ts` and wraps the model of `createAuthorizer` in
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

## The identity provider

The provider authenticates, the context authorizes ([Identity](../tools/identity.md)). After a
decision is committed, `IdentityProviderAdmin` tells the provider, at most once, in an
after-commit handler. `KeycloakIdentityProviderAdmin` calls the administration API of Keycloak
26 or later, the realm having organizations enabled, as a confidential client holding the roles
`manage-users` and `manage-realm` of `realm-management` (the organizations endpoints ask the
second). It reads `KEYCLOAK_URL`,
`KEYCLOAK_REALM`, `IDENTITY_PROVIDER_ADMIN_CLIENT_ID` and `IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET`
when a call is made, so a project that does not use it starts without them.

Another provider (Zitadel, Auth0, Entra ID) is another adapter of the same port: four methods
(`openOrganisation`, `addMember`, `removeMember`, `disableAccount`), its spec run against a local
HTTP server as the Keycloak one is, declared `@Adapter(IdentityProviderAdmin)` in place of the
Keycloak one. A provider that needs nothing from the application gets an adapter whose methods
do nothing, which its class comment says.

The Keycloak adapter is specified against the paths and bodies of the Keycloak 26 documentation
by a local server; it was not run against a real Keycloak by the kit.

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
