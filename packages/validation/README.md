# @ddd-ts-kit/validation

One `Schema` contract for input validation at the boundary, with adapters for zod,
class-validator, TypeBox and any Standard Schema library. Routes, DTOs and the OpenAPI generator depend
on the contract, so the validation library can change without touching them.

Business rules do not belong here: they live in the domain and never import a validation library.

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

The root entry imports no third-party package. Each adapter lives in its own subpath and its
library is an optional peer dependency: install only the one you use.

## zod

```sh
npm i zod
```

```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

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

const placeOrder = classSchema(PlaceOrderDto);
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

```ts
import { omitClass, partialClass, pickClass } from '@ddd-ts-kit/validation/class-validator';

class RescheduleBody extends pickClass(AppointmentDto, ['startsAt', 'endsAt']) {}
class BookBody extends omitClass(AppointmentDto, ['status']) {}
class EditPatientBody extends partialClass(PatientDto) {} // every property optional, checked when present
```

The class that extends a helper names the shape in the contract. Picking a property that carries
no constraint is refused: validation would strip it as unknown. A derived class nested in
another one through `@Type` declares at least one property of its own: class-validator-jsonschema
documents a class only from its own decorators.

## TypeBox

```sh
npm i typebox
```

```ts
import Type from 'typebox';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';

const slot = Type.Object({ startsAt: Type.String({ format: 'date-time' }), minutes: Type.Integer({ default: 30 }) }, { $id: 'Slot' });
const book = typeboxSchema(Type.Object({ patientId: Type.String({ minLength: 1 }), slot }));
const page = typeboxSchema(Type.Object({ limit: Type.Integer() }), { coerce: true }); // query strings
```

The schema is compiled once (`typebox/compile`). `parse` fills the defaults and drops the
properties the schema does not declare, as zod does, then checks; the issue code is the JSON
Schema keyword that failed (`required`, `format`, `minLength`...). `{ coerce: true }` converts
text to the declared types first, for path parameters and query strings. A TypeBox schema is
JSON Schema already: `toJsonSchema()` returns it, a nested schema built with an `$id` moved
under `$defs` and referenced, so it lands once in the contract; a schema with its own `$id` is
shared. `Type.Pick`, `Type.Omit`, `Type.Partial` and `Type.Composite` reuse a schema in part.
Written for the `typebox` package, version 1 (the successor of `@sinclair/typebox`).

## Standard Schema (valibot, arktype, ...)

```ts
import * as v from 'valibot';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';

const placeOrder = standardSchema(
  v.object({ customerId: v.pipe(v.string(), v.uuid()) }),
  // Optional: the JSON Schema of the contract, which this adapter does not derive.
  { type: 'object', required: ['customerId'], properties: { customerId: { type: 'string', format: 'uuid' } } },
);
```

The adapter validates with `~standard.validate` of Standard Schema v1. The JSON Schema of the
contract is the second argument when it is given (written by hand, or produced by the exporter of
your library); otherwise the one the library converts itself when it implements the companion
specification, Standard JSON Schema v1 (`~standard.jsonSchema`: zod 4, arktype, valibot through
`toStandardJsonSchema` of `@valibot/to-json-schema`), input side by default and
`standardSchema(schema, undefined, { io: 'output' })` for a response; otherwise `{}`, which the
OpenAPI document shows as "any value". The specification carries no error code, so every issue
has the code `invalid`. A schema that validates asynchronously makes
`parse` throw: async schemas are not supported at the boundary.

## Shared schemas

A schema several routes use is declared once and documented once: the OpenAPI generator of
`@ddd-ts-kit/http` writes it in `components.schemas` and points at it with `$ref` from every
route, whole or nested. A schema is shared when its JSON Schema is a reference to one of its own
definitions (`{ $ref: '#/$defs/Slot', $defs: { Slot: ... } }`), the form each library reaches its
own way:

```ts
// zod: an id in its metadata, kept when the schema is nested in another one
const slot = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });
const reschedule = zodSchema(slot);
const book = zodSchema(z.object({ patientId: z.uuid(), slot }));

// class-validator: the name of the class
const patient = classSchema(PatientDto, { shared: true });

// TypeBox: an $id in its options, kept when the schema is nested in another one
const money = Type.Object({ cents: Type.Integer(), currency: Type.String() }, { $id: 'Money' });

// any schema, the Standard Schema ones included
const amount = sharedSchema('Amount', standardSchema(amountSchema));
```

`sharedNameOf(jsonSchema)` answers the name a JSON Schema is shared under, if any. A shared
schema of the presentation layer lives where `generate schema` writes it: under
`presentation/http/schemas/` of its context, or under `presentation/` of the shared kernel when
several contexts answer with it; never in the domain.
