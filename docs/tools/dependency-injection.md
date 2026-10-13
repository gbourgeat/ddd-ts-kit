**English** · [Français](dependency-injection.fr.md)

# Dependency injection: tsyringe with declarations, NestJS, manual wiring

**Summary.** Clean Architecture needs one thing from dependency injection: a single place, the
composition root, where adapters are bound to ports. This kit offers three ways to write that
place. With tsyringe and `@ddd-ts-kit/di`, classes declare what they are and the context is
assembled from the declarations, with wiring errors found before anything is instantiated.
With NestJS, the framework's container does the job and contexts are wired explicitly. With
manual wiring, a function builds the objects by hand. All three keep `domain/` and
`application/` free of any container; they differ in how much is checked for you and in how
much the kit can generate.

## What is being decided

Whatever the tool, the rules are the same (`composition/only-in-module`, `layer/*`,
`ports/*` in [ARCHITECTURE.md](../ARCHITECTURE.md) and the
[ports and composition](../concepts/ports-and-composition.md) page): a port is an abstract
class, a use case receives its ports by constructor, and only the composition root knows which
adapter stands behind which port.

```ts
// contexts/appointments/application/commands/book-appointment/book-appointment.handler.ts
@CommandHandler(BookAppointment)
export class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookAppointment): Promise<string> { /* ... */ }
}
```

The decorator comes from `@ddd-ts-kit/kernel/declarations`. It is metadata only: it
instantiates nothing and imports no container. What the handler depends on is said once, by
its constructor: `ddd-ts-kit docs` reads the signature from the source and writes the list
the container injects into the generated file of the context
([ports and composition](../concepts/ports-and-composition.md), "How the constructor reaches
the composition root", compares this with a list in the decorator and with
`emitDecoratorMetadata`, which holds in three of the ten compiler and runner combinations
measured). The same handler class, without the decorator, is what NestJS or manual wiring
would bind.

## Comparison

| | tsyringe + `@ddd-ts-kit/di` | NestJS container | Manual wiring |
|---|---|---|---|
| Who assembles a context | the kit, from declarations (generated barrel or discovery) or from an explicit module | as generated, the same `<context>Module(platform)` function as manual wiring; Nest providers by factory when you bind in Nest modules yourself | a `<context>Module(platform)` function in `<context>.module.ts`: plain calls to constructors, registrations between markers |
| Style available (`stack.style`) | `declared` or `explicit`, mixable | `explicit` only | `explicit` only |
| Injection token | the port class itself | Nest tokens; ports bound in the module | none: plain variables |
| What a class is given | what its constructor takes, each parameter typed by a port: read from the source into a generated file, never reflected | whatever the provider factory passes, or Nest's own `design:paramtypes` and `@Inject` when you declare providers by class | the arguments of `new Handler(a, b)` |
| Decorators in your classes | declarations in `application/` and `infrastructure/`, none in `domain/`; no parameter decorator, no reflection | `@Injectable()` kept out of `domain/` and `application/` by rule; providers declared by factory | none |
| Decorator mode | standard or legacy | legacy | not concerned |
| Errors found before start | duplicate binding, unbound dependency, cycle, duplicate handler, consumer or job, undeclared authorization, and more (`WiringError` with a code) | Nest's own resolution errors at bootstrap | the compiler, for constructors; nothing for a forgotten handler |
| Cross-cutting hook | `instrumentation` of `kernelModule` (tracing, from outside), `around(kinds, ...)` in a module for every binding of a kind, `.with(...)` or the `aspects` of a declaration for one binding | call the wrappers in the provider factory | call the wrappers by hand |
| Test application | `createTestApplication` with `fake(Port, instance)` | Nest testing module, or `createTestBuses` | `createTestBuses` |
| Extra runtime dependencies | `tsyringe`, `reflect-metadata` | the Nest packages | none |

## The underlying libraries, checked on 2026-10-10

- **tsyringe** (Microsoft, MIT): latest npm version 4.10.0, published 2025-04-16; about 14
  million downloads a week. The repository is not archived, but its last functional commits
  date from April 2025 (the only later commit, September 2026, pins CI actions), its last
  GitHub release tag is v4.4.0 from 2020, and 82 issues are open. In plain words: widely
  used, stable, in low-activity maintenance. It refuses to load without `reflect-metadata`
  (0.2.2, March 2024).
- **How much the kit depends on it.** `@ddd-ts-kit/di` uses a tsyringe child container as a
  registry: ports are registered under a symbol identity, dependencies are named in lists and
  never reflected, no tsyringe decorator appears in your code, and `reflect-metadata` is
  imported by the package only because tsyringe demands it. The surface exposed to tsyringe's
  future is therefore small, and the wiring checks are the kit's own. It is still a dependency
  on a quiet project: a team for which that is unacceptable has the two other options, at the
  cost stated below.
- **NestJS** (MIT): `@nestjs/core` 12.1.2, published 2026-09-30, about 16 million downloads a
  week, Node 20 or later, actively released.
- **Alternatives not supported by the kit**, for context only: InversifyJS 8.2.3 and Awilix
  13.0.5 are both maintained (releases in 2026). Neither has an adapter here; using one means
  `stack.di: manual` semantics from the kit's point of view.

## Selection criteria

1. **Do you want the declared style?** One decorator per class, no module file, no
   dependency list: a generated barrel, which also registers what each constructor takes, kept
   current by the generator (`declarations/barrel-current`). Only tsyringe gives
   it, and it is its default: the CLI refuses `--style declared` with `--di manual` and
   `--di nest`, which default to `explicit`. `--di nest` goes with `--http nest` and the
   reverse.
2. **Is NestJS already the framework?** Then its container is there anyway
   ([HTTP frameworks](http-frameworks.md)).
3. **How much checking at start do you want?** The checks of `createApplication` (a command
   with two handlers, two consumers sharing a name, a use case that declares no permission)
   are what manual wiring gives up.
4. **Bundling and cold start.** A barrel with `contextModule` is static and followed by a
   bundler; discovery reads directories at startup and cannot be bundled.
5. **Dependency budget.** Manual wiring adds nothing.

## What this kit supports and verified

From [`packages/di/README.md`](../../packages/di/README.md),
[`packages/kernel/README.md`](../../packages/kernel/README.md) and
[`packages/cli/README.md`](../../packages/cli/README.md):

- **Constructor injection that holds whoever compiles**: both decorator modes, `tsc` 6 and 7,
  `tsx`, Vitest and Jest with swc, because nothing is asked of the compiler at run time.
- **Compile-time checks**, in both decorator modes: a generated or written dependency list that does not match the
  constructor, a class that does not implement the port it is declared the adapter of, a
  concrete class named where a port is expected.
- **Load-time checks** (`DeclarationError`): a port with a body, an adapter that extends its
  port, two declarations on one class.
- **Start-time checks** (`WiringError`): duplicate or missing bindings, cycles between class
  bindings, duplicate handlers, consumers and jobs, `rebind` of nothing, a declared class
  whose constructor takes parameters and that no list covers, or a list of another length; with
  `authorization: 'required'`, a use case that declares neither a permission nor that it is
  public, and declarations that no module enforces.
- **`kernelModule()`** binds a working default for every kernel port (in-memory buses, unit of
  work, cache, lock, rate limiter, no-op logger and metrics), each replaceable by option or by
  `rebind`.
- **Two assemblies** of a declared context (`stack.assembly`): `barrel` (default) and
  `discovery`, with or without a broker. `--assembly` is refused with `--style explicit`.
- **Proven end to end by the CLI** (`proven-stacks.spec.ts`, as its README lists them):
  generated projects in the declared style (the default stack; with ReBAC and RabbitMQ; with
  knex and discovery, alone and behind NATS), in the explicit style on tsyringe (the default
  stack; with ReBAC and RabbitMQ), and with `--di manual` (with ABAC and knex; with Fastify,
  knex, RabbitMQ and Redis). No generated NestJS project appears in that list: NestJS stacks
  are generated and held to `check` and to the type check, not installed and run.
- **Test application** with fixed clock, sequential identifiers, in-memory buses and fakes
  bound under the port class.

## Limits and when not to use it

Stated by the package:

- A class plays one role: one declaration per class. An adapter that implements two ports is
  bound explicitly, once per port.
- A declaration is not inherited: a subclass declares itself or is bound explicitly.
- Names (consumer, policy, job, domain event) are written in the declaration, never derived
  from the class name.
- A port of your own is identified by its class: loaded from two copies of a package it is two
  tokens, unless it declares a `tokenKey`. An application compiled as one program never meets
  this.
- Factories do not declare what they resolve: a cycle or a missing port going through a
  factory is reported when it is resolved, not at start.
- Discovery imports files that nothing else imports: knip and dependency-cruiser must be told,
  it runs sequentially at startup, and a bundler cannot follow it.
- A class decorator of another library that replaces the class must sit below the kit's
  declaration.

Of the alternatives:

- **NestJS**: explicit style only; the kit's routes bypass Nest's request pipeline; the legacy
  decorator mode applies to the whole program; the start-time checks above are replaced by
  Nest's.
- **Manual**: no check that every handler is registered or every use case protected beyond
  what `ddd-ts-kit check` reads in the text (`authz/declared`,
  `events/consumer-idempotent`); cross-cutting wrappers are applied by hand, so one forgotten
  call is one untraced adapter.

Do not introduce a container at all in a script, a migration or a context of three classes run
alone: constructing the objects by hand is the composition root.

## Recommendation by situation

| Situation | Choice |
|---|---|
| New project on Express or Fastify | tsyringe with the declared style and a barrel: the default, the most generated, the most checked |
| Unusual wiring in one context (factories, conditional bindings) | the same, with an explicit module for that context, or `include` in a mixed module |
| Serverless or bundled deployment | tsyringe, `contextModule` with the barrel; avoid discovery |
| Existing NestJS application | NestJS container, explicit style, providers by factory |
| A policy against low-activity dependencies, or a very small service | manual wiring, knowing which start-time checks are given up |

## Sources

- tsyringe: https://github.com/microsoft/tsyringe (commits, releases and issues read on
  2026-10-10); npm registry entry `tsyringe`.
- NestJS documentation, custom providers: https://docs.nestjs.com/fundamentals/custom-providers
- InversifyJS: https://inversify.io ; Awilix: https://github.com/jeffijoe/awilix
- TypeScript 5.0 release notes, decorators:
  https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
- Robert C. Martin, Clean Architecture, Prentice Hall, 2017, chapter 26 ("The Main
  Component").
- Mark Seemann, "Composition Root" (2011): https://blog.ploeh.dk/2011/07/28/CompositionRoot/
- Martin Fowler, "Inversion of Control Containers and the Dependency Injection pattern"
  (2004): https://martinfowler.com/articles/injection.html

## See also

- [Ports and composition](../concepts/ports-and-composition.md)
- [Layers and the dependency rule](../concepts/layers-and-dependency-rule.md)
- [HTTP frameworks](http-frameworks.md)
- [Testing strategy](../concepts/testing-strategy.md)
- [Static analysis and pipeline](static-analysis-and-pipeline.md)
- [Configuration](../CONFIG.md)
