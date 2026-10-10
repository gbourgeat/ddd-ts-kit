# @ddd-ts-kit/validation

One `Schema` contract for input validation at the boundary, with adapters for zod,
class-validator and any Standard Schema library. Routes, DTOs and the OpenAPI generator depend
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
3.1). It describes the input side by default; pass `{ io: 'output' }` for a response body.

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
constraint name as `code`. The JSON Schema carries the nested classes under `$defs`.

Requires `experimentalDecorators` in the project's `tsconfig.json`.

## Standard Schema (valibot, arktype, ...)

```ts
import * as v from 'valibot';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';

const placeOrder = standardSchema(
  v.object({ customerId: v.pipe(v.string(), v.uuid()) }),
  // Optional: Standard Schema has no JSON Schema export, so the contract side is yours to give.
  { type: 'object', required: ['customerId'], properties: { customerId: { type: 'string', format: 'uuid' } } },
);
```

Without the second argument `toJsonSchema()` returns `{}`. The specification carries no error
code, so every issue has the code `invalid`. A schema that validates asynchronously makes
`parse` throw: async schemas are not supported at the boundary.
