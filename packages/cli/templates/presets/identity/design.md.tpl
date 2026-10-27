## Design

Written by the identity preset of ddd-ts-kit (`--preset identity`); from now on it is the code of
this project, to change like any other.

**The identity provider authenticates, this context authorizes.** An account is a person under
the subject their provider gives them (`actor.id`): it is provisioned at their first sign-in from
what their token says (`PUT /accounts/me`) and refreshed at each later one. No password, no secret
of the provider is stored here. The email address of an account is always the one of the token,
never one a client sends, and one the provider verified (`email_verified`): an invitation is
matched on it. A deactivated account leaves every organisation and ends every delegation in the
same unit of work, so that it holds no right anywhere while its last token lives; the last owner
of an organisation appoints another owner before deactivating.

**Organisations, members and roles.** An organisation is opened under its slug, which is its
identity for good, and its opener is its first owner. A member holds one role, `owner`, `admin`
or `member`; what a role grants is one table, `RoleRightsService`. Nobody changes their own role,
and nobody appoints, invites, changes or removes anyone above their own role (only an owner makes
an owner), whatever a delegation lends them. An organisation keeps one owner at least: every
change of a member saves the organisation with it, so that its version orders the changes of its
owners and two owners who remove each other at once cannot both commit.

**Invitations.** An invitation is issued to an email address, in a role, for a week. Its token
is answered to the inviter once (`POST /organisations/:organisationId/invitations`) and only its
SHA-256 digest is stored: send it to the person (a notification context, a link), who accepts or
declines it signed in, with the address it was sent to.

**Delegations.** A member lends some of the rights of their role to another member of the
organisation, for ninety days at most: the delegate acts in their own name, with those rights, and
the audit trail of the project records every use case either way; the facts a change leads to
name the delegation it was decided under (`delegationId`). A delegation lends nothing beyond the
role of its delegator, never what was lent to them, never the power to act above the delegate's
own role, and it ends when one of its two members leaves or when its delegator changes role.

**Who may do what.** Every use case requires a permission of `{{context.camel}}Permissions`, which
the platform grants to every signed-in person whatever its access model (roles, attribute
policies, relationships, OpenFGA or an adapter of the project): the grant `'{{context.kebab}}:*'`
of `signed-in-grants.ts`, which `createAuthorizer` answers before it asks the model
(`SignedInGrantsAuthorizer` of `@ddd-ts-kit/auth`). Systems, services and anonymous callers get
nothing from it.

Inside an organisation, the policies of `application/authorization/` decide on the rights the
actor holds there (`OrganisationRights`): their role, and the rights an active delegation lends
them. The integration events (`member.joined`, `member.role-changed`, `member.removed`,
`delegation.granted`, `delegation.revoked`) let another context write the relationships of its
own model, or the tuples of OpenFGA, from these facts.
{{#if tenancy.any}}

**Tenants.** Each organisation is a tenant: its slug is the tenant id, the integration events of
an organisation carry it as their tenant, and the consumers of the other contexts run in it. The
tables of this context belong to no tenant, since it decides who belongs to which ({{preset.adr}}):
`ddd-ts-kit.config.json` declares it the control plane of the tenants
(`contexts.{{context.kebab}}.tenancy` set to `control-plane`), so its repositories are generated
unconfined and `tenancy/scoped-statement` does not judge its adapters.
The token names the organisations of the person: with Keycloak, the `organization` claim, which
`createAuthenticator` reads (`tenantClaim: 'organization'`). One organisation is the tenant of
every request; several are the `tenants` of the actor, and a request names the one it works in
(`x-tenant-id`), refused if the person is not a member of it.
{{/if}}

**The identity provider follows, at least once.** The consumers of `application/integration/handlers/`
read the facts the context publishes through its outbox and tell the provider
(`IdentityProviderAdmin`): it knows the organisation under its slug, adds or removes its members,
and disables a deactivated account. A provider that is down is asked again by whoever delivers the
fact (the outbox relay, the broker) until it answers, so a removal or a deactivation is never
lost; each consumer brings the provider in line with what the context holds now, so that a late
retry never gives a removed person their organisation back. `KeycloakIdentityProviderAdmin` is a
recipe for the administration API of Keycloak 26 or later (organizations enabled in the realm), as
a confidential client holding `manage-users` and `manage-realm` of `realm-management`; it reads
`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `IDENTITY_PROVIDER_ADMIN_CLIENT_ID` and
`IDENTITY_PROVIDER_ADMIN_CLIENT_SECRET` when a call is made. Its spec runs it against a local
server that answers as Keycloak does: run it once against your realm before relying on it. Another
provider is another adapter of the same port.

