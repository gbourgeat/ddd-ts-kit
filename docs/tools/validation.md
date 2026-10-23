**English** · [Français](validation.fr.md)

# Validation libraries: zod, class-validator, TypeBox, Standard Schema

**Summary.** Validation in this kit means one thing: checking the shape of what crosses a
boundary (an HTTP request, an integration event payload). It is done behind a small `Schema`
port of `@ddd-ts-kit/validation`, with adapters for zod, class-validator, TypeBox and any
library that implements Standard Schema (valibot, arktype and others). Because routes, events and the
OpenAPI generator depend on the port, the library is replaceable; what differs between the
four adapters is the quality of the generated contract, the error codes and the decorator
mode they impose. Business rules are not validation and never use these libraries.

## Where validation sits

"`startsAt` is an ISO date-time" is validation: it is true or false of the text alone. "The
slot is still free" is an invariant of `appointments`; "only the client who booked may cancel"
is a permission. The three live in three places
([invariants, permissions and validation](../concepts/invariants-permissions-validation.md)),
and `layer/domain-purity` in [ARCHITECTURE.md](../ARCHITECTURE.md) refuses a validation library
in `domain/`.

![A request to book an appointment passes three checks in three layers: the schema of the route checks its shape (refused with 422 VALIDATION_FAILED), the bus checks the permission of the actor (refused with 403 FORBIDDEN), the value object and the aggregate check the invariants (refused with the code of the domain, such as INVALID_TIME_SLOT)](../assets/diagrams/validation-three-checks.svg)

<!-- checked sample -->
```ts
// contexts/appointments/presentation/http/book-appointment.schema.ts: the shape of the request, nothing else
import { z } from 'zod';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

export const bookAppointmentBody = zodSchema(
  z.object({
    practitionerId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  }),
);

// { practitionerId: string; startsAt: string; endsAt: string }
export type BookAppointmentBody = Infer<typeof bookAppointmentBody>;
```

That `endsAt` is after `startsAt` is decided once, by the `TimeSlot` value object, whoever
calls: a route, an integration event handler or a job. Instead of writing the rule into the
schema of one route:

```ts
// presentation/http: the rule holds for this route only, and its refusal is a VALIDATION_FAILED
const bookAppointmentBody = zodSchema(
  z
    .object({ practitionerId: z.uuid(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() })
    .refine((body) => body.endsAt > body.startsAt, { message: 'endsAt must follow startsAt' }),
);
```

write it in the domain, where every caller meets it, with a code of its own:

<!-- checked sample -->
```ts
// contexts/appointments/domain/value-objects/time-slot.vo.ts
import { DomainRefusal, ValueObject } from '@ddd-ts-kit/kernel';

// contexts/appointments/appointments.codes.ts
export const AppointmentsCodes = { InvalidTimeSlot: 'INVALID_TIME_SLOT' } as const;

// contexts/appointments/domain/errors/invalid-time-slot.error.ts
export class InvalidTimeSlot extends DomainRefusal {
  readonly code = AppointmentsCodes.InvalidTimeSlot;

  static forBounds(startsAt: Date, endsAt: Date) {
    return InvalidTimeSlot.refusal('A slot ends after it starts.', { startsAt, endsAt });
  }
}

export class TimeSlot extends ValueObject<{ readonly startsAt: Date; readonly endsAt: Date }> {
  static create(startsAt: Date, endsAt: Date): TimeSlot {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw InvalidTimeSlot.forBounds(startsAt, endsAt);
    }

    return new TimeSlot({ startsAt, endsAt });
  }
}
```

## The port

```ts
interface Schema<T> {
  parse(input: unknown): Result<T, ValidationIssue[]>; // never throws for an invalid input
  toJsonSchema(): JsonSchema;                          // feeds OpenAPI and AsyncAPI
}
```

A schema is a value handed to the route or the event that validates with it. It is never bound
in a container, which is why it is an interface and not an injectable port. `parseOrThrow`
raises a `ValidationError`, a `DomainError` with the code `VALIDATION_FAILED`, which the HTTP
pipeline answers as a 422 problem with one issue per path.

![Four adapters (zod, class-validator, TypeBox, Standard Schema) produce a value of the Schema port; its parse method serves the routes and the integration event handlers, its toJsonSchema method serves the OpenAPI and AsyncAPI documents and the event catalog](../assets/diagrams/validation-one-port.svg)

What a caller gets back, with the zod schema above and a body that misses `endsAt` and carries a
malformed id:

<!-- checked sample -->
```ts
import { z } from 'zod';
import { parseOrThrow, ValidationError } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const bookAppointmentBody = zodSchema(
  z.object({ practitionerId: z.uuid(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }),
);
const input: unknown = { practitionerId: 'nope', startsAt: '2026-03-02T09:00:00Z' };

// parse never throws for an invalid input: it answers a Result
const result = bookAppointmentBody.parse(input);

if (!result.ok) {
  // [{ path: 'practitionerId', code: 'invalid_format', message: 'Invalid UUID' },
  //  { path: 'endsAt', code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }]
  console.log(result.error);
}

// parseOrThrow answers the value, or throws what the HTTP pipeline answers as a 422 problem
try {
  parseOrThrow(bookAppointmentBody, input);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.code, error.issues.length); // VALIDATION_FAILED 2
  }
}
```

A route never calls either itself: the pipeline of `@ddd-ts-kit/http` parses each part with the
schema the route declares, and the handler receives the parsed value. A property the schema
does not declare is dropped by zod and TypeBox, and refused by class-validator.

## Comparison

Versions, licences and downloads checked on 2026-10-10 against the npm registry and GitHub.

| | zod | class-validator | TypeBox | Standard Schema (valibot, arktype, ...) |
|---|---|---|---|---|
| What it is | schema builder, types inferred from the schema | decorators on DTO classes, with class-transformer | JSON Schema builder with static types, compiled validators | a common interface that schema libraries implement, not a library |
| Current version | 4.6.5 | 0.15.1 (February 2026); class-transformer 0.5.1 dates from November 2021 | `typebox` 1.3.36 (2026-10-06; `@sinclair/typebox` 0.34 is its predecessor) | spec 1.1.0; valibot 1.5.0, arktype 2.2.8 |
| Licence | MIT | MIT | MIT | MIT |
| Weekly downloads | about 326 million | about 12 million | not checked | valibot about 22 million, arktype about 2 million |
| Decorators | none | legacy mode required for the whole program | none | none |
| Type from schema | yes, inferred | the class is the type, written by hand | yes, inferred (`Static`) | yes, inferred |
| JSON Schema for the contract | built in (`z.toJSONSchema`, draft 2020-12) | through `class-validator-jsonschema`, a separate package | the schema is JSON Schema | the library's own when it implements Standard JSON Schema (verified with zod 4; arktype and valibot through `@valibot/to-json-schema` not verified), or the one you supply |
| Shared once in the contract | `.meta({ id })`, kept when nested | `classSchema(Dto, { shared: true })`; a nested class always is | `$id` in the options, kept when nested | the library's ids, or `sharedSchema(name, schema)` |
| Reuse in part | `.pick`, `.omit`, `.partial`, `.extend` | `pickClass`, `omitClass`, `partialClass` of the kit, `extends` | `Type.Pick`, `Type.Omit`, `Type.Partial`, `Type.Intersect` (keeps the reference) or `Type.Interface` (a flat copy) | the library's own (`v.pick`, `v.omit`, ...) |
| Issue codes | the library's (`too_small`, ...) | the constraint name | the JSON Schema keyword (`minLength`, `format`) | always `invalid` |
| Cost of one parse, measured ([contract pairs](contract-pairs.md)) | about 0.5 µs | about 5 to 9 µs | about 6 to 11 µs (its own check alone, 0.75 µs) | not measured |
| Asynchronous schemas | not at the boundary | not at the boundary | not at the boundary | `parse` throws |

### The same body in each library

The body of the booking route, four times. Each line ends in the same `Schema`, which a route
takes as it is.

class-validator, with legacy decorators and `reflect-metadata`:

<!-- checked sample: legacy-decorators -->
```ts
import 'reflect-metadata';
import { IsISO8601, IsUUID } from 'class-validator';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';

class BookAppointmentDto {
  @IsUUID() practitionerId = '';
  @IsISO8601({ strict: true }) startsAt = '';
  @IsISO8601({ strict: true }) endsAt = '';
}

// parse answers an instance of BookAppointmentDto; an undeclared property is an issue
export const bookAppointmentBody = classSchema(BookAppointmentDto);
```

TypeBox, whose schema is JSON Schema already:

<!-- checked sample -->
```ts
import Type from 'typebox';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';

// issue codes are the JSON Schema keywords: 'required' for endsAt, 'format' for practitionerId
export const bookAppointmentBody = typeboxSchema(
  Type.Object({
    practitionerId: Type.String({ format: 'uuid' }),
    startsAt: Type.String({ format: 'date-time' }),
    endsAt: Type.String({ format: 'date-time' }),
  }),
);
```

valibot through Standard Schema, with the JSON Schema of the contract given by hand:

<!-- checked sample -->
```ts
import * as v from 'valibot';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';

const instant = { type: 'string', format: 'date-time' };

// every issue has the code 'invalid'; without the second argument the contract would show {}
export const bookAppointmentBody = standardSchema(
  v.object({
    practitionerId: v.pipe(v.string(), v.uuid()),
    startsAt: v.pipe(v.string(), v.isoTimestamp()),
    endsAt: v.pipe(v.string(), v.isoTimestamp()),
  }),
  {
    type: 'object',
    required: ['practitionerId', 'startsAt', 'endsAt'],
    properties: { practitionerId: { type: 'string', format: 'uuid' }, startsAt: instant, endsAt: instant },
  },
);
```

zod is the first sample of this page.

## Selection criteria

1. **The contract.** The OpenAPI and AsyncAPI documents are generated from `toJsonSchema()`.
   A library that cannot describe itself produces an empty contract unless you write the JSON
   Schema twice.
2. **Decorator mode.** class-validator forces `experimentalDecorators` on the program. The
   kit's own decorators work in both modes, but other libraries may not.
3. **What the team already has.** A NestJS code base usually holds hundreds of DTO classes;
   rewriting them buys nothing.
4. **Error detail.** Clients that branch on issue codes need a library that provides them.
5. **Maintenance.** class-validator still releases; its companion class-transformer has had no
   release since 2021 (checked today). That is a fact to weigh, not a verdict: the package is
   small and stable.

## What this kit supports and verified

From [`packages/validation/README.md`](../../packages/validation/README.md):

- **zod.** `zodSchema(schema, { io? })`. The JSON Schema comes from zod 4's own export and is
  usable as is in OpenAPI 3.1; it describes the input side by default, `{ io: 'output' }` for a
  response body. `.describe(...)` on a field flows into the event catalog and the contract.
- **class-validator.** `classSchema(Dto, options?)`. `parse` returns an instance of the class;
  `whitelist` and `forbidNonWhitelisted` are on by default, so an undeclared property is an
  issue; nested errors are flattened (`items.0.quantity`), one issue per failed constraint;
  nested classes land under `$defs`. Needs `class-transformer`, `class-validator-jsonschema`
  and `reflect-metadata`, and `experimentalDecorators` in the project.
- **Standard Schema.** `standardSchema(schema, jsonSchema?, { io? })` accepts any implementing
  library; without a JSON Schema it documents the one the library converts itself through
  Standard JSON Schema, when it implements it and can convert that schema (verified with zod 4),
  else `{}`.
- **Shared schemas.** A shape declared once is documented once: the OpenAPI generator writes it in
  `components.schemas` and every route refers to it, whole or nested. `sharedSchema(name,
  schema)` shares any `Schema`; the platform shares `acceptedSchema` (`Accepted`), the page of a
  shared item (`<Item>Page`) and the problem document. Under `"stack.schemas": "shared"` (a new
  project), `generate schema` writes one and `schema/no-duplicate-shape` reports a shape
  declared twice in one context ([configuration](../CONFIG.md)).
- `customSchema(parse, jsonSchema?)` builds a schema from a plain function, for the rare input
  no library describes:

<!-- checked sample -->
```ts
import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';

// a practitioner reference written "<practiceId>.<practitionerId>", split on the way in
export const practitionerKey = customSchema(
  (input: unknown) => {
    const [practiceId, practitionerId, ...rest] = typeof input === 'string' ? input.split('.') : [];

    return practiceId && practitionerId && rest.length === 0
      ? ok({ practiceId, practitionerId })
      : err([{ path: '', code: 'practitioner_key', message: 'Expected <practiceId>.<practitionerId>' }]);
  },
  { type: 'string', pattern: '^[^.]+\\.[^.]+$' },
);
```

- The root entry imports no third-party package; each adapter is a subpath with its library as
  an optional peer.
- The CLI generates DTO files with class-validator and schemas otherwise; the "first-class
  stack" proven end to end by the CLI uses `--validation class-validator` in the legacy
  decorator mode, and the default stack uses zod
  ([`packages/cli/README.md`](../../packages/cli/README.md)).

## Limits and when not to use it

- **Standard Schema adapter and the contract.** Standard Schema itself has no JSON Schema
  export; its companion specification, Standard JSON Schema (V1), has one, and the adapter reads
  it when the library implements it (zod 4 does, checked with 4.6.5; valibot only through
  `toStandardJsonSchema` of `@valibot/to-json-schema`). For any other library, pass the JSON
  Schema by hand or accept an empty contract for that input.
- **class-validator in part.** `pickClass`, `omitClass` and `partialClass` copy the metadata of
  class-validator and class-transformer onto a new class meant to be extended. A derived class
  nested in another through `@Type` declares a property of its own, because
  class-validator-jsonschema documents a class from its own decorators only.
- **Two shapes under one name.** zod documents the input and the output side of a schema with
  defaults differently: a shared schema used as a body and as a response gets two components
  (`Slot`, `Slot_2`). Give the response an id of its own.
- **Standard Schema issue codes.** The specification carries none: every issue has the code
  `invalid`.
- **No asynchronous validation at the boundary**: a schema that validates asynchronously makes
  `parse` throw. A check that needs I/O (does this practitioner exist?) is not validation; it
  belongs to the use case.
- **class-validator returns class instances**, and transformation happens through
  class-transformer: a DTO with defaults or `@Type` conversions changes what the handler
  receives. Keep DTOs free of behaviour.
- **Query strings are strings.** Coercion (`z.coerce.number()`, `@Type(() => Number)`) is part
  of the schema.
- **A schema is not a model.** Reusing a presentation schema in `application/` or `domain/` is
  a defect the layer rules report; a response schema is a presentation DTO, mapped from the
  model.
- **Tightening a schema on a deployed API is a breaking change** for clients that were sending
  what used to be tolerated.

Do not reach for a validation library to protect an aggregate: a value object's `create` does
it, with a `DomainError` and a stable code, and it holds for every caller.

## Recommendation by situation

| Situation | Choice |
|---|---|
| New project, no constraint | zod: the default of the kit, inferred types, the contract generated without a second description |
| NestJS, or an existing base of decorated DTO classes | class-validator: keep the DTOs, accept the legacy decorator mode |
| The contract must be exactly the schema, or Fastify is already in place | TypeBox: the schema is JSON Schema, composed with `Type.Pick`, `Type.Omit`, `Type.Intersect` |
| The team already standardised on valibot or arktype, or bundle size at the edge matters | Standard Schema adapter, with the JSON Schema supplied for every public input |
| Integration event payloads | the same library as the routes: one vocabulary of schemas for both contracts |
| An input no library fits | `customSchema`, with its JSON Schema |

Mixing is possible (any `Schema` works in a route) and rarely wise: two issue vocabularies in
one API confuse its clients.

## Sources

- zod documentation, JSON Schema conversion: https://zod.dev/json-schema
- class-validator: https://github.com/typestack/class-validator ; class-transformer:
  https://github.com/typestack/class-transformer (repository activity and releases read on
  2026-10-10)
- Standard Schema and Standard JSON Schema: https://standardschema.dev
- valibot: https://valibot.dev ; arktype: https://arktype.io
- TypeBox: https://github.com/sinclairzx81/typebox
- npm registry: versions, licences and weekly downloads read on 2026-10-10.
- JSON Schema draft 2020-12: https://json-schema.org/draft/2020-12
- Standard JSON Schema read by the adapter: verified with zod 4.6.5, whose schemas implement
  `~standard.jsonSchema` (`input` and `output`, target `draft-2020-12`); not verified with
  arktype or with `@valibot/to-json-schema`.

## See also

- [HTTP frameworks](http-frameworks.md)
- [Invariants, permissions and validation](../concepts/invariants-permissions-validation.md)
- [Entities and value objects](../concepts/entities-and-value-objects.md)
- [Event versioning](../concepts/event-versioning.md)
- [Architecture reference](../ARCHITECTURE.md)
