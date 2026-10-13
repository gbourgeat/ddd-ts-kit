# Validation libraries: zod, class-validator, Standard Schema

**Summary.** Validation in this kit means one thing: checking the shape of what crosses a
boundary (an HTTP request, an integration event payload). It is done behind a small `Schema`
port of `@ddd-ts-kit/validation`, with adapters for zod, class-validator and any library that
implements Standard Schema (valibot, arktype and others). Because routes, events and the
OpenAPI generator depend on the port, the library is replaceable; what differs between the
three adapters is the quality of the generated contract, the error codes and the decorator
mode they impose. Business rules are not validation and never use these libraries.

## Where validation sits

"`startsAt` is an ISO date-time" is validation: it is true or false of the text alone. "The
slot is still free" is an invariant of `appointments`; "only the client who booked may cancel"
is a permission. The three live in three places
([invariants, permissions and validation](../concepts/invariants-permissions-validation.md)),
and `layer/domain-purity` in [ARCHITECTURE.md](../ARCHITECTURE.md) refuses a validation library
in `domain/`.

```ts
// contexts/appointments/presentation/http: the shape of the request, nothing else
const bookAppointmentBody = zodSchema(
  z.object({
    practitionerId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }),
);
```

That `endsAt` is after `startsAt` is decided once, by the `TimeSlot` value object, whoever
calls: a route, an integration event handler or a job.

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

## Comparison

Versions, licences and downloads checked on 2026-10-10 against the npm registry and GitHub.

| | zod | class-validator | Standard Schema (valibot, arktype, ...) |
|---|---|---|---|
| What it is | schema builder, types inferred from the schema | decorators on DTO classes, with class-transformer | a common interface that schema libraries implement, not a library |
| Current version | 4.6.5 | 0.15.1 (February 2026); class-transformer 0.5.1 dates from November 2021 | spec 1.1.0; valibot 1.5.0, arktype 2.2.8 |
| Licence | MIT | MIT | MIT |
| Weekly downloads | about 326 million | about 12 million | valibot about 22 million, arktype about 2 million |
| Decorators | none | legacy mode required for the whole program | none |
| Type from schema | yes, inferred | the class is the type, written by hand | yes, inferred |
| JSON Schema for the contract | built in (`z.toJSONSchema`, draft 2020-12) | through `class-validator-jsonschema`, a separate package | the library's own when it implements Standard JSON Schema (zod, arktype, valibot through `@valibot/to-json-schema`), or the one you supply |
| Shared once in the contract | `.meta({ id })`, kept when nested | `classSchema(Dto, { shared: true })`; a nested class always is | the library's ids, or `sharedSchema(name, schema)` |
| Reuse in part | `.pick`, `.omit`, `.partial`, `.extend` | `pickClass`, `omitClass`, `partialClass` of the kit, `extends` | the library's own (`v.pick`, `v.omit`, ...) |
| Issue codes | the library's (`too_small`, ...) | the constraint name | always `invalid` |
| Asynchronous schemas | not at the boundary | not at the boundary | `parse` throws |

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
  Standard JSON Schema, when it implements it.
- **Shared schemas.** A shape declared once is documented once: the OpenAPI generator writes it in
  `components.schemas` and every route refers to it, whole or nested. `sharedSchema(name,
  schema)` shares any `Schema`; the platform shares `acceptedSchema` (`Accepted`), the page of a
  shared item (`<Item>Page`) and the problem document. Under `"stack.schemas": "shared"` (a new
  project), `generate schema` writes one and `schema/no-duplicate-shape` reports a shape
  declared twice ([configuration](../CONFIG.md)).
- `customSchema(parse, jsonSchema?)` builds a schema from a plain function, for the rare input
  no library describes.
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
