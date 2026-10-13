**English** · [Français](0001-combine-token-roles-with-relationships-in-one-authorizer.fr.md)

# ADR-0001: Combine token roles with relationships in one authorizer

- Status: accepted
- Date: 2026-10-10

## Context

Most rights of this application are about one element: who manages a practice, who holds or is delegated a desk, whose appointment it is. They change with the data, so they are relationships (the `rebac` model the kit supports), stored as tuples and written in the unit of work of the change they describe (`authorization.relation_tuples`).

A few rights are about no element at all: an administrator of the platform opens a practice or reads the audit trail, any signed-in user registers as a person or browses calendars, a patient books for themselves on a calendar they have no relationship with. The identity provider already states those facts as realm roles in the token. The kit offers one `Authorizer` port per application and one model behind it, so the two sources have to be combined somewhere. This is a choice among supported options (an adapter of the `Authorizer` port written in the platform), not a deviation from the architecture reference.

The application also acts on its own behalf: scheduled jobs and integration event handlers send protected commands as system actors.

## Decision

The platform binds one authorizer, `RolesAndRelationshipsAuthorizer`, which answers in this order:

1. the anonymous actor is refused;
2. a system actor named `<context>.<what it does>` may use the permissions of that context on the resource `context:<context>`, without a stored tuple;
3. a role of the token may grant the permission, from the table `src/platform/auth/role-grants.ts`; a grant may depend on a fact the use case states in the `context` of its requirement (`selfService: true` for a patient who books for themselves); a system actor never holds a role;
4. otherwise the relationships decide, through `RelationBasedAuthorizer` over the schema of `relationship-schema.ts` and the mapping of `resource-permissions.ts`.

For a list, only a grant marked `listing: 'all'` and without condition answers `{ kind: 'all' }` (the administrator of the platform). Every other grant opens the use case only: the relationships answer which elements.

## Consequences

- Easier: a right over no element costs one line of a table read at a glance, and needs no tuple to be written when a user appears or a role changes in the identity provider. Integration event handlers need no line in `relate-system-actors.ts`; the generated lines of the jobs stay and are harmless.
- Harder: there are two places to look for the reason of a decision. The denial codes say which one answered: `NO_MATCHING_ROLE` when only a role could have granted, `NO_RELATION`, `RESOURCE_REQUIRED` or `UNMAPPED_PERMISSION` from the relationships.
- To watch: the role table must stay short. A right that depends on an element belongs to the schema, never to a role. A role grant is as fresh as the token: revoking a role takes effect when the token expires, where deleting a tuple is immediate.
- To watch: the role table and the mapping name permissions by id. An id that no context declares is never asked and grants nothing, so a renamed permission fails closed, silently. A spec comparing those ids with the permission registry is worth adding once the contexts are stable.
- To watch: rule 2 trusts the name of a system actor. That name is only ever given by the code of a context (`systemActor(...)`); no authenticator produces an actor of type `system`. It holds as long as that stays true.
- Impersonation is orthogonal: the token of the impersonated user carries their roles and relationships, and the command bus refuses every command of such a session (`IMPERSONATION_READ_ONLY`).

## Alternatives considered

- **One authorizer over both sources (chosen).** An adapter of the `Authorizer` port in the platform: supported by the kit, no change to the contexts.
- **Roles as tuples.** A `platform` object with an `admin` relation, written when a role is given. One model and one place to look, but the identity provider stays the source of the roles, so the tuples would be a copy to keep in sync (a listener on its events, or a write at each sign-in), and a missed synchronization would grant or refuse wrongly. The conditional grant of a patient has no equivalent: the kit implements no caveat on a tuple.
- **Policies only.** Attribute policies evaluated through `Access` on the loaded element. They cannot answer a listing without loading every element, they put delegation and membership into the code of each context where the schema states them once, and they would still need the roles next to them.
- **One tuple per system actor.** The generated approach: a line in `relate-system-actors.ts` for each job and each handler. Kept for the jobs, which the generator writes; dropped for the handlers, where a forgotten line only shows as a consumer failing at run time.
