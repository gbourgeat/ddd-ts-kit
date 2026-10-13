**English** · [Français](README.fr.md)

# @ddd-ts-kit/validation

One `Schema` contract for input validation at the boundary, with adapters for zod,
class-validator, TypeBox and any Standard Schema library. Routes, DTOs and the OpenAPI generator depend
on the contract, so the validation library can change without touching them.

Business rules do not belong here: they live in the domain and never import a validation library.

![A request at the boundary: its params, query, headers and body each go through the Schema the route declares; when every part parses, the handler receives typed values and the domain checks the business rules; when a part fails, its issues are collected with the name of the part in front of their path, such as body.items.0.sku, and the request is refused with one ValidationError, code VALIDATION_FAILED, answered 422 with the list of issues; the same schemas give the JSON Schema of the OpenAPI document](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/validation-package-at-the-boundary.svg)

A schema checks the **shape** of what comes in: types, required fields, formats, lengths. What
the business decides (a slot in the past, a quantity above the stock) is checked by the domain,
whatever the entry point:

<!-- checked sample -->
```ts
import { z } from 'zod';
import { ConceptError } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// Instead of: a business rule hidden in the schema of one route, which a job or a consumer never meets.
export const bookWithARule = zodSchema(
  z.object({ startsAt: z.iso.datetime() }).refine((body) => Date.parse(body.startsAt) > Date.now(), 'The slot is in the past.'),
);

// Write: the shape in the schema...
export const book = zodSchema(z.object({ startsAt: z.iso.datetime() }));

// ...and the rule in the domain, with its own refusal code.
export class SlotError extends ConceptError {
  static inThePast(startsAt: Date) {
    return SlotError.refusal('SLOT_IN_THE_PAST', `The slot at ${startsAt.toISOString()} is in the past.`, {
      startsAt: startsAt.toISOString(),
    });
  }
}

export function startingAt(startsAt: Date, now: Date): Date {
  if (startsAt <= now) {
    throw SlotError.inThePast(startsAt);
  }

  return startsAt;
}
```

## The contract

```ts
import { parseOrThrow, type Infer, type Schema } from '@ddd-ts-kit/validation';

interface Schema<T> {
  parse(input: unknown): Result<T, ValidationIssue[]>;
  toJsonSchema(): JsonSchema;
}

type ValidationIssue = { path: string; code: string; message: string }; // path: "items.0.sku"
```

A schema is a value: one per input, handed to the route or the event that validates with it.
It is never bound in a container, so it is an interface and not an injectable port (an abstract
class): there is nothing to declare in a composition root.

- `parse` never throws for an invalid input: it returns `err(issues)`.
- `parseOrThrow(schema, input)` returns the value or throws a `ValidationError`, a `DomainError`
  with code `VALIDATION_FAILED` and the `issues`.
- `Infer<typeof schema>` gives the parsed type.
- `customSchema(parse, jsonSchema?)` builds a schema from a plain function.
- `sharedSchema(name, schema)` documents a schema once, under `name` (see [shared schemas](#shared-schemas)).

<!-- checked sample -->
```ts
import { err, ok } from '@ddd-ts-kit/kernel';
import { ValidationError, customSchema, parseOrThrow, type Infer } from '@ddd-ts-kit/validation';

// A schema from a plain function: a check written by hand, or a double in a test.
const quantity = customSchema(
  (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) && input > 0
      ? ok(input)
      : err([{ path: '', code: 'not_a_quantity', message: 'A positive whole number is expected.' }]),
  { type: 'integer', minimum: 1 },
);

type Quantity = Infer<typeof quantity>; // number

export const refused = quantity.parse('3'); // { ok: false, error: [{ path: '', code: 'not_a_quantity', ... }] }
export const three: Quantity = parseOrThrow(quantity, 3); // 3

try {
  parseOrThrow(quantity, 0);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.code, error.issues); // VALIDATION_FAILED [{ path: '', code: 'not_a_quantity', ... }]
  }
}
```

The root entry imports no third-party package. Each adapter lives in its own subpath and its
library is an optional peer dependency: install only the one you use.

## At the route

A route of `@ddd-ts-kit/http` names a schema for each part of the request it reads. Every part
is parsed before the handler runs, the issues of all parts are answered together, and each
issue path starts with its part:

<!-- checked sample -->
```ts
import { z } from 'zod';
import { defineRoute, executeRoute, type RawRequest } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const placeOrder = defineRoute(
  {
    method: 'POST',
    path: '/orders',
    operationId: 'placeOrder',
    summary: 'Place an order',
    request: {
      body: zodSchema(z.object({ items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1) })),
    },
    responses: { 201: { description: 'The order is placed.', body: zodSchema(z.object({ lines: z.number() }), { io: 'output' }) } },
    security: false,
  },
  async ({ body }) => ({ status: 201, body: { lines: body.items.length } }), // body is typed: { items: { sku, quantity }[] }
);

const request = (body: unknown): RawRequest => ({ params: {}, query: {}, headers: {}, body, raw: undefined });

export const placed = await executeRoute(placeOrder, request({ items: [{ sku: 'A-1', quantity: 2 }] })); // 201, { lines: 1 }
export const refused = await executeRoute(placeOrder, request({ items: [{ sku: 'A-1', quantity: 0 }] }));
// 422, a problem with the code VALIDATION_FAILED and
// issues: [{ path: 'body.items.0.quantity', code: 'too_small', message: 'Too small: expected number to be >0' }]
```

The handler never sees an invalid request, and the OpenAPI document of the route describes the
same body, from `toJsonSchema()`.

## zod

```sh
npm i zod
```

<!-- checked sample -->
```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

declare const input: unknown; // what the request carried

const placeOrder = zodSchema(
  z.object({
    customerId: z.string().uuid(),
    items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  }),
);

const result = placeOrder.parse(input);
if (!result.ok) {
  console.log(result.error); // [{ path: 'items.0.sku', code: 'too_small', message: '...' }]
}
```

The JSON Schema comes from zod 4's `z.toJSONSchema` (draft 2020-12, usable as is in OpenAPI
3.1). It describes the input side by default; pass `{ io: 'output' }` for a response body. A
type JSON Schema cannot represent (a `Date`, a `bigint`) is written as `{}` rather than
failing the generation.

## class-validator

```sh
npm i class-validator class-transformer class-validator-jsonschema reflect-metadata
```

<!-- checked sample: legacy-decorators -->
```ts
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';

class OrderItemDto {
  @IsString() sku = '';
  @IsInt() @Min(1) quantity = 0;
}

class PlaceOrderDto {
  @IsUUID() customerId = '';

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items: OrderItemDto[] = [];
}

export const placeOrder = classSchema(PlaceOrderDto);
```

`parse` returns an instance of the class. `whitelist` and `forbidNonWhitelisted` are on by
default: an undeclared property is an issue. Override with
`classSchema(Dto, { validator: { forbidNonWhitelisted: false }, transform: { ... } })`.
Nested errors are flattened (`items.0.quantity`), one issue per failed constraint, the
constraint name as `code`. The JSON Schema is draft 2020-12 and carries the nested classes
reachable from the class under `$defs`.

Requires `experimentalDecorators` in the project's `tsconfig.json`.

A DTO class declared once is reused whole (`classSchema(SlotDto, { shared: true })`, or nested
with `@ValidateNested()` and `@Type`), extended (`class BookBody extends SlotDto { ... }`) or in
part, through three helpers that copy the constraints, the nested types and the transformations
of the properties they keep:

<!-- checked sample: legacy-decorators -->
```ts
import { IsEmail, IsIn, IsISO8601, IsString, IsUUID } from 'class-validator';
import { omitClass, partialClass, pickClass } from '@ddd-ts-kit/validation/class-validator';

class AppointmentDto {
  @IsUUID() patientId = '';
  @IsISO8601() startsAt = '';
  @IsISO8601() endsAt = '';
  @IsIn(['booked', 'cancelled']) status = 'booked';
}

class PatientDto {
  @IsString() name = '';
  @IsEmail() email = '';
}

export class RescheduleBody extends pickClass(AppointmentDto, ['startsAt', 'endsAt']) {}
export class BookBody extends omitClass(AppointmentDto, ['status']) {}
export class EditPatientBody extends partialClass(PatientDto) {} // every property optional, checked when present
```

The class that extends a helper names the shape in the contract. Picking a property that carries
no constraint is refused: validation would strip it as unknown. A derived class nested in
another one through `@Type` declares at least one property of its own: class-validator-jsonschema
documents a class only from its own decorators.

## TypeBox

```sh
npm i typebox
```

<!-- checked sample -->
```ts
import Type from 'typebox';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';

export const slot = Type.Object({ startsAt: Type.String({ format: 'date-time' }), minutes: Type.Integer({ default: 30 }) }, { $id: 'Slot' });
export const book = typeboxSchema(Type.Object({ patientId: Type.String({ minLength: 1 }), slot }));
export const page = typeboxSchema(Type.Object({ limit: Type.Integer() }), { coerce: true }); // query strings
```

The schema is compiled once (`typebox/compile`). `parse` fills the defaults and drops the
properties the schema does not declare, as zod does, then checks; the issue code is the JSON
Schema keyword that failed (`required`, `format`, `minLength`...). `{ coerce: true }` converts
text to the declared types first, for path parameters and query strings. A TypeBox schema is
JSON Schema already: `toJsonSchema()` returns it, a nested schema built with an `$id` moved
under `$defs` and referenced, so it lands once in the contract; a schema with its own `$id` is
shared. A missing property is reported at its own path (`slot.startsAt`), as zod reports it, and
two different schemas under one `$id` are refused. `Type.Pick`, `Type.Omit` and `Type.Partial`
reuse a schema in part, as a new shape; `Type.Intersect([slot, Type.Object({...})])` extends it
and keeps the shared part a reference (`allOf: [{ $ref: Slot }, ...]`), while
`Type.Interface([slot], {...})` writes a new flat shape. (`Type.Composite` belongs to
`@sinclair/typebox` 0.34 and does not exist in TypeBox 1.)
Written for the `typebox` package, version 1 (the successor of `@sinclair/typebox`).

## Standard Schema (valibot, arktype, ...)

<!-- checked sample -->
```ts
import * as v from 'valibot';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';

export const placeOrder = standardSchema(
  v.object({ customerId: v.pipe(v.string(), v.uuid()) }),
  // Optional: the JSON Schema of the contract, which this adapter does not derive.
  { type: 'object', required: ['customerId'], properties: { customerId: { type: 'string', format: 'uuid' } } },
);
```

The adapter validates with `~standard.validate` of Standard Schema v1. The JSON Schema of the
contract is the second argument when it is given (written by hand, or produced by the exporter of
your library); otherwise the one the library converts itself when it implements the companion
specification, Standard JSON Schema v1 (`~standard.jsonSchema`; verified with zod 4, while arktype
and valibot through `toStandardJsonSchema` of `@valibot/to-json-schema` announce it but are not
verified here), input side by default and `standardSchema(schema, undefined, { io: 'output' })`
for a response; otherwise `{}`, which the OpenAPI document shows as "any value". A schema the
library cannot write as JSON Schema (zod refuses `z.date()`, `z.coerce.date()`, `z.custom`) is
documented `{}` as well: pass its JSON Schema as the second argument. The specification carries no error code, so every issue
has the code `invalid`. A schema that validates asynchronously makes
`parse` throw: async schemas are not supported at the boundary.

## Shared schemas

A schema several routes use is declared once and documented once: the OpenAPI generator of
`@ddd-ts-kit/http` writes it in `components.schemas` and points at it with `$ref` from every
route, whole or nested. A schema is shared when its JSON Schema is a reference to one of its own
definitions (`{ $ref: '#/$defs/Slot', $defs: { Slot: ... } }`), the form each library reaches its
own way:

![A schema shared under the name Slot: its JSON Schema is a reference to its own definition; the routes reschedule and book use it, one whole and one nested in its body; the OpenAPI generator writes Slot once under components.schemas and points at it with $ref from both routes, instead of two copies](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/validation-package-shared-schemas.svg)

<!-- checked sample -->
```ts
import Type from 'typebox';
import * as v from 'valibot';
import { z } from 'zod';
import { sharedSchema } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

declare class PatientDto {
  name: string;
  email: string;
}

// zod: an id in its metadata, kept when the schema is nested in another one
const slot = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });
export const reschedule = zodSchema(slot);
export const book = zodSchema(z.object({ patientId: z.uuid(), slot }));

// class-validator: the name of the class
export const patient = classSchema(PatientDto, { shared: true });

// TypeBox: an $id in its options, kept when the schema is nested in another one
const money = Type.Object({ cents: Type.Integer(), currency: Type.String() }, { $id: 'Money' });
export const price = typeboxSchema(Type.Object({ amount: money }));

// any schema, the Standard Schema ones included
const amountSchema = v.object({ cents: v.pipe(v.number(), v.integer()) });
export const amount = sharedSchema('Amount', standardSchema(amountSchema));
```

`sharedNameOf(jsonSchema)` answers the name a JSON Schema is shared under, if any:

<!-- checked sample -->
```ts
import { customSchema, sharedNameOf, sharedSchema } from '@ddd-ts-kit/validation';

const amount = sharedSchema('Amount', customSchema((input) => ({ ok: true, value: input }), { type: 'integer' }));

export const jsonSchema = amount.toJsonSchema(); // { $ref: '#/$defs/Amount', $defs: { Amount: { type: 'integer' } } }
export const name = sharedNameOf(jsonSchema); // 'Amount'
```

A shared schema of the presentation layer lives where `generate schema` writes it: under
`presentation/http/schemas/` of its context, or under `presentation/` of the shared kernel when
several contexts answer with it; never in the domain.
