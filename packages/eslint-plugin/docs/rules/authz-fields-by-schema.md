**English** · [Français](authz-fields-by-schema.fr.md)

# ddd-ts-kit/authz-fields-by-schema

Architecture id: `authz/fields-by-schema`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `application/queries/` of a context, tests excluded.

## Why

A query that removes a field for the callers without a role answers one way in JSON and is
forgotten in the CSV export, the XML of a partner and the form of the front end; nobody reading
the contract knows the field may be missing. Marked on the response schema with
`withFieldAccess` of `@ddd-ts-kit/http`, the field is reserved to a permission or a policy once:
the pipeline leaves it out of every representation for an actor who may not read it, refuses it
in a request body from one who may not set it, the contract says so with `x-field-access`, and a
form described by the server shows it read-only or not at all. Which rows the actor may read at
all stays the access scope of the query.

## Reported

- a call of `includes`, `some`, `every`, `find` or `indexOf` on a `roles` property
- a comparison (`===`, `!==`, `==`, `!=`) of a `role` property
- a read of an `isAdmin` property

Incorrect:

```ts
export class GetAppointmentHandler {
  async execute(query: GetAppointmentQuery): Promise<AppointmentView> {
    const view = await this.appointments.findById(query.appointmentId);

    return query.actor.roles.includes('practitioner') ? view : { ...view, internalNote: undefined };
  }
}
```

Correct:

```ts
// application/queries/get-appointment/get-appointment.handler.ts
return this.appointments.findById(query.appointmentId);

// presentation/http/appointments/get-appointment/get-appointment.controller.ts
const answer = withFieldAccess(classSchema(GetAppointmentAnswer), {
  internalNote: { read: { permission: schedulingPermissions['appointment.note.read'] } },
});
```

## Checker

`ddd-ts-kit check` reports the same tests under the same id, from the text of the file.
