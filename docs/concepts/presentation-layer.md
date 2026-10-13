**English** · [Français](presentation-layer.fr.md)

# The presentation layer: controllers, route groups, guards

**Summary.** A route is one class with one method, `handle`, whose decorator is the single
statement of the route: method, path, schemas, response, error codes. A route group gives a set
of routes a prefix, a tag and guards. A guard is a control at the edge; a permission stays on
the use case. A request mapper and a serializer are the two optional places that translate.
The rules are in the [architecture reference](../ARCHITECTURE.md) (`presentation/*`,
`authz/declared`), the API in [`@ddd-ts-kit/http`](../../packages/http/README.md).

## One class per route

```ts
// presentation/http/appointments.routes.ts
import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/appointments', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class AppointmentsRoutes {}
```

```ts
// presentation/http/appointments/book-appointment/book-appointment.controller.ts
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';
import { BookAppointmentAccepted } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.accepted';
import type { BookAppointmentMapper } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.mapper';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const body = classSchema(BookAppointmentBody);
const accepted = classSchema(BookAppointmentAccepted);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book appointment',
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: accepted },
  errors: [
    'UNKNOWN_CALENDAR',
    'UNKNOWN_APPOINTMENT_TYPE',
    'OUTSIDE_AVAILABILITY',
    'OFF_GRID',
    'BOOKING_TOO_LATE',
    'BOOKING_TOO_FAR',
    'SLOT_TAKEN',
    'PATIENT_LIMIT_REACHED',
  ],
})
export class BookAppointmentController {
  constructor(
    private readonly commands: CommandBus,
    private readonly mapper: BookAppointmentMapper,
  ) {}

  async handle(request: HttpRequest<{ body: BookAppointmentBody }>): Promise<BookAppointmentAccepted> {
    const id = await this.commands.execute(this.mapper.map(request));

    return { id };
  }
}
```

```ts
// presentation/http/appointments/book-appointment/book-appointment.mapper.ts
import { RequestMapper, type HttpRequest } from '@ddd-ts-kit/http';
import { BookAppointmentCommand } from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';
import type { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';

/** The one place that turns the request to book and its actor into the command. */
@RequestMapper()
export class BookAppointmentMapper
  implements RequestMapper<HttpRequest<{ body: BookAppointmentBody }>, BookAppointmentCommand>
{
  map({ actor, body }: HttpRequest<{ body: BookAppointmentBody }>): BookAppointmentCommand {
    const { calendarId, appointmentTypeId, startsAt, patientId } = body;
    // Without a patient named, the caller books for themselves.
    const wish = { patientId: patientId ?? actor.id, appointmentTypeId, startsAt: new Date(startsAt) };

    return new BookAppointmentCommand(actor, calendarId, wish);
  }
}
```

The decorator declares, the pipeline validates with the same schemas, and the OpenAPI contract
is generated from them: nothing repeats the route. The constructor states the dependencies, as
for every declared class; the generated file of the context registers
`injected(BookAppointmentController, [CommandBus, BookAppointmentMapper])` from the signature,
and the composition root mounts every declared controller with
`controllerRoutes(resolve(DeclaredEdges).of('controller'), { resolve })`. A controller knows no
framework: it becomes a `Route`, which Express, Fastify and NestJS mount as they mount any
route, so validation, problem documents, the error mapper and the span of the request are the
ones of a function route.

## How the compiler holds `handle` to the declaration

A decorator cannot change the type of the class it decorates, but it can refuse a class.
`@Controller(spec)` is typed as a function that accepts only a class whose `handle` takes what
the schemas of `spec` produce and returns the body `spec.response` declares:

- `handle` reads `HttpRequest<{ body: BookAppointmentBody }>`: the declaration must have a
  `body` schema whose output is assignable to it. A controller that reads a part its
  declaration does not validate, or reads it as another type, does not compile.
- `handle` returns the output type of `response.body`, or nothing when the response has no
  body.
- The request is contravariant: `handle` names only the parts it reads, and may take no
  parameter at all.

The error is reported on the decorator, in both decorator modes (standard and
`experimentalDecorators`) and with every validation library, since a schema is a `Schema<T>`
value whatever built it: `zodSchema(..)`, `classSchema(Class)`, `standardSchema(..)`,
`customSchema(..)`. `packages/http/test/fixtures/controllers/controller-mistakes.ts` holds six
mistakes that must not compile, built by TypeScript 6 and 7 in each mode.

The options that were compared:

| Option | What it costs | Verdict |
|---|---|---|
| a typed contract object shared by the decorator and `implements HttpController<typeof contract>` | a second statement next to the class, and `implements` compares a method parameter bivariantly: a wrong body type is accepted | rejected |
| a base class or a factory, `extends controller(contract)` | the same second statement, inheritance for a type check, and a method that overrides one is not given its parameter types | rejected |
| inference of the contract from `handle` | the schemas would be derived from types, which do not exist at run time | impossible |
| the decorator constrains the class | one statement; the parameter of `handle` is annotated by hand, with the classes or `Infer<typeof schema>` | chosen |

No option gives `handle` its parameter types without an annotation: TypeScript infers the
parameters of a method from nothing but the method.

## Route groups and guards

A group is an empty class carrying `@RouteGroup({ prefix, tags, guards, errors, parent })`. A
child group inherits the prefix, the tags, the guards and the error codes of its parent and adds
its own. A controller names its group and may add guards. A controller with no group and no
guard is refused, when its class is defined and by `authz/declared`: no route is open by
omission. `guards: [Public]` says a route is open, and `Public` stands alone.

A guard is `{ documents?, check(request) }`: it returns to let the request through and throws
`UnauthorizedError` or `ForbiddenError` to refuse it. What it documents (the error codes, a
security scheme of its own) joins the contract of every route behind it, so the 401 and 403
responses are said once. The kit ships `Authenticated`, `Public` and `HasRole(...roles)`,
which read the `Actor` of the request. A guard of the project that needs a dependency is a
declared class:

```ts
// presentation/http/guards/same-clinic.guard.ts
@Guard()
export class SameClinicGuard implements Guard {
  readonly documents = { errors: ['FORBIDDEN'] };

  check({ actor, params }: GuardRequest): void {
    if (actor.tenantId !== params['clinicId']) {
      throw new ForbiddenError('The caller belongs to another clinic');
    }
  }
}
```

**The split.** A guard answers "may this caller use these routes at all", from the caller and
the request. A permission answers "may this actor do this to this element", and it is declared
on the command or the query with `@Requires`, decided by the bus. A job, an event handler or
another transport that sends the same command never passes a guard and is still held to the
permission. So a guard never replaces a permission, and never loads an aggregate
(`presentation/guard-at-the-edge`). `HasScope('invoices:read')` keeps routes for a session
granted every scope named: the JWT and Keycloak authenticators fill `Session.scopes` from the
`scope` (or `scp`) claim, and a project declares its vocabulary by augmenting `SessionScopes`, so
a misspelt scope does not compile. A scope bounds what a client application may do on behalf of
the user, never what the user may do: the permission still decides. See
[Choosing access control](../guides/choosing-access-control.md).

## Mapper and serializer

Both are optional and both are declared classes, so a controller is given them by its
constructor. `RequestMapper<Request, Message>` has one method, `map`: the one place that turns
the request and its actor into the command or the query. `Serializer<Result, Body>` has one
method, `serialize`: the one place that turns a result into what a client reads. Neither
signature names HTTP beyond the type of the request, so another transport or another format
writes its own next to them and the use case does not move. A controller that only forwards
has neither (`presentation/controller-delegates` holds what a controller may be given).

## When to keep a function route

`defineRoute` stays supported and both forms run in one project. Keep a function when the
route answers several success statuses, sets response headers of its own (`Location`), answers
bytes or text, or is built from data at run time: a controller has one response and answers its
body. Caching headers are not a reason: a controller declares its cache policy, its validators
and its cache tags (`cache`), and the pipeline answers them ([HTTP caching](http-caching.md)).
