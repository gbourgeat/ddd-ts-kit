# Relationships: who holds a right, the resource, the searches

Read under `stack.authz: rebac`, before declaring a permission, a use case or a search. The model
itself (types, stored and derived relations, `anyOf`, `allOf`, `butNot`, `via`, the tuple store,
`RESOURCE_REQUIRED`, `explain`) is in `docs/concepts/authorization-in-practice.md` of the kit,
"Relationships", with a worked preset in `docs/guides/choosing-access-control.md`, "Preset 3:
relationships (Zanzibar)"; the PostgreSQL tuple store or OpenFGA in
`docs/tools/authorization-engines.md`. What follows is what a session writes and what `check`
refuses.

## Who holds a permission

`--grant` is refused: the right is given in the schema. A permission left on the context is held
by its operators, and `check` warns (`authz/granted`) until some source writes an `operator`
relationship on that context (a provisioning step, a bootstrap, the grant of a system actor) or
every signed-in person holds it.

A job or a handler that sends a protected command acts as a system actor, which needs its own
relationship in `relationships/relate-system-actors.ts` (`generate job` writes it for a job, a
handler by hand needs it): `authz/system-actor-granted` is an error without it.

## The resource of a use case

`generate command` and `generate query` (not a search) write the context as the resource,
`{ resource: () => ({ type: 'context', id: '<context>' }) }`, and a
`// TODO(domain): name the <element> this command is about` next to it, which `todo` and `status`
list. The context is the right resource only for a use case on no element: declaring a service,
running a search (its scope narrows the ids). A use case about one element (change the
dependencies of a service, add a member to a team) names that element, once its message carries
the id:

```ts
@Requires(cataloguePermissions['service.change'], {
  resource: (command) => ({ type: 'service', id: command.serviceId }),
})
```

and the schema derives the permission on that type
(`service: { derived: { [cataloguePermissions['service.change'].id]: 'owning-member' } }` in
`elements` of `relationships/relationship-schema.ts`).

- The schema written by `init` derives on `context` only the permissions no element derives:
  modelling a right on an element takes it away from the operators of the context.
- A right left on the context is held by every operator of it, and the project's bridge from
  roles to permissions (a member holds it) widens it to every member: any member then acts on any
  element, and every spec written as a member of the owning team stays green.
- When a search runs under the permission of its element, give the gate its own permission
  (`service.search`, on the context) and keep the scope on the element's (`service.view`), since
  the first is no longer held on the context once derived on the element.
- `authz/resource-modelled` (an error under relationships) reports a requirement on the context
  for a permission the schema derives on an element, and a search whose gate and scope share such
  a permission; a schema or a resource it cannot read is reported too.

## Searches

- **May the actor run it?** The requirement of the query always names a resource
  (`RESOURCE_REQUIRED` otherwise): the enclosing one the generator writes,
  `{ resource: () => ({ type: 'context', id: '<context>' }) }`, or the element for the use cases
  that are about one (above). When an actor who reaches no element must get 403 rather than an
  empty page, name the tenant of the actor instead, `{ type: 'tenant', id: <its tenant> }`, with,
  on the type `tenant`, the derived relation
  `[<ctx>Permissions['folder.search'].id]: via('folder', <ctx>Permissions['folder.view'].id)` and a
  tuple `tenant:<id>#folder@folder:<id>` written with each element. That check reads the elements
  of the tenant one by one for an actor who holds none.
- **Which elements?** `Access.scope(query.actor, <context>Permissions['folder.view'], 'folder')`:
  the relationships answer `ids`.

Prove it with the real authorizer (the schema, the mapping and an `InMemoryRelationTupleStore`
in `authorizationModule`), never `AllowAll` nor an answer written by hand: an element is absent
for an actor with no relation to it, absent for the actor of another element, and absent from
the page asked without any criterion.
