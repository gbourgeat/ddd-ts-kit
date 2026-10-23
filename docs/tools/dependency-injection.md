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

![The handler of the application depends on two ports; an adapter of the infrastructure implements each port; the composition root, written in one of three styles, is the only place that binds each adapter to its port](../assets/diagrams/dependency-injection-composition-root.svg)

The handler of the running example books an appointment. It names what it needs by port, in
its constructor, and nothing else:

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor, type Clock, type IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

// contexts/appointments/domain/aggregates/appointment.aggregate.ts, reduced to what the sample uses
declare class Appointment {
  static book(props: { id: string; clientId: string; startsAt: Date; bookedAt: Date }): Appointment;
  readonly id: string;
}

// contexts/appointments/domain/repositories/appointment.repository.ts: a port is an abstract class
export abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}

// contexts/appointments/application/authorization/appointments.permissions.ts
export const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

// contexts/appointments/application/commands/book-appointment/book-appointment.command.ts
@Requires(appointmentsPermissions['appointment.book'])
export class BookAppointment extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}

// contexts/appointments/application/commands/book-appointment/book-appointment.handler.ts
@CommandHandler(BookAppointment)
export class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookAppointment): Promise<string> {
    const appointment = Appointment.book({
      id: this.ids.next(),
      clientId: command.actor.id,
      startsAt: command.startsAt,
      bookedAt: this.clock.now(),
    });

    await this.appointments.save(appointment);

    return appointment.id;
  }
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

What the rules refuse is a use case that fetches its own dependencies. Instead of reaching
for the container, or building the adapter, inside the application layer:

```ts
// application/commands/book-appointment/book-appointment.handler.ts: refused
// layer/application-inward: a container package and an infrastructure file, imported by the application
import { container } from 'tsyringe';
import { KnexAppointmentRepository } from '@/contexts/appointments/infrastructure/persistence/knex-appointment.repository';

export class BookAppointmentHandler {
  // composition/only-in-module: the adapter is chosen here, for good, and a test cannot replace it
  private readonly appointments = new KnexAppointmentRepository();
  // a hidden dependency: the constructor no longer says what the handler needs
  private readonly clock = container.resolve(Clock);

  async execute(command: BookAppointment): Promise<string> { /* ... */ }
}
```

write the constructor above: the handler receives its ports, a test gives it fakes, and the
choice of the adapter stays in the composition root.

## The same context, three composition roots

The three styles bind the same classes. Only the place where the binding is written changes.

**Declared (tsyringe and `@ddd-ts-kit/di`).** Each class carries its declaration; the context is
assembled from the classes themselves. `ddd-ts-kit docs` writes, in the generated file of the
context, the list each constructor receives, and `contextModule` turns the declarations into
bindings:

<!-- checked sample -->
```ts
import { AuthorizedCommand, Clock, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';
import { CommandHandler, Repository, injected } from '@ddd-ts-kit/kernel/declarations';
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';

// the classes of the first sample, reduced to their shape
declare class Appointment {
  readonly id: string;
}
abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, startsAt: Date);
}

@CommandHandler(BookAppointment)
class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookAppointment): Promise<string> {
    // the body of the first sample
    return `${this.ids.next()} booked at ${this.clock.now().toISOString()} for ${command.actor.id}`;
  }
}

// contexts/appointments/infrastructure/persistence/in-memory-appointment.repository.ts
@Repository(AppointmentRepository)
class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly saved: Appointment[] = [];

  async save(appointment: Appointment): Promise<void> {
    this.saved.push(appointment);
  }
}

// contexts/appointments/application/application.declarations.ts, generated: never written by hand
injected(BookAppointmentHandler, [AppointmentRepository, Clock, IdGenerator]);

// main.ts
export async function main(): Promise<void> {
  const appointments = contextModule('appointments', { BookAppointmentHandler, InMemoryAppointmentRepository });
  const app = createApplication({ modules: [kernelModule(), appointments] });

  await app.start();
}
```

In a project, the composition root imports the whole generated barrel instead of naming the
classes: `contextModule('appointments', appointments)` after
`import * as appointments from '@/contexts/appointments/appointments.declarations'`. That file
only re-exports the generated declarations of each layer of the context, where the
`injected` statements are, one file per layer (`application/application.declarations.ts`).

**Explicit (tsyringe and `@ddd-ts-kit/di`).** Every binding is a statement of
`<context>.module.ts`, with the list of what each constructor takes. No decorator is needed:

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, Clock, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';

// the classes of the first sample, without their decorators
declare class Appointment {
  readonly id: string;
}
abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, startsAt: Date);
}
declare class BookAppointmentHandler {
  constructor(appointments: AppointmentRepository, clock: Clock, ids: IdGenerator);
  execute(command: BookAppointment): Promise<string>;
}
abstract class Database {
  abstract readonly url: string;
}
declare class KnexAppointmentRepository implements AppointmentRepository {
  constructor(database: Database);
  save(appointment: Appointment): Promise<void>;
}
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

// contexts/appointments/appointments.module.ts
export const appointmentsModule = defineContextModule({
  name: 'appointments',
  register(builder) {
    builder.bind(Database).toValue({ url: 'postgres://localhost/appointments' });
    builder.bind(AppointmentRepository).toClass(KnexAppointmentRepository, [Database]);
    builder
      .command(BookAppointment)
      .requires(appointmentsPermissions['appointment.book'])
      .handledBy(BookAppointmentHandler, [AppointmentRepository, Clock, IdGenerator]);
  },
});

// main.ts
export const app = createApplication({ modules: [kernelModule(), appointmentsModule] });
```

The compiler holds each list to its constructor: `[Clock, AppointmentRepository, IdGenerator]`
(another order) or `[AppointmentRepository, Clock]` (one short) does not compile.

**Manual (`--di manual`, and the contexts of `--di nest`).** A function of the platform builds
the objects with `new` and registers each handler on the bus; the generator writes the
registrations between markers of `<context>.module.ts`:

<!-- checked sample -->
```ts
import { definePermissions, requires, type UseCaseDeclaration } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor, type Clock, type IdGenerator, type InMemoryCommandBus } from '@ddd-ts-kit/kernel';

// the classes of the first sample, without their decorators
declare class Appointment {
  readonly id: string;
}
interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
}
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, startsAt: Date);
}
declare class BookAppointmentHandler {
  constructor(appointments: AppointmentRepository, clock: Clock, ids: IdGenerator);
  execute(command: BookAppointment): Promise<string>;
}
declare class KnexAppointmentRepository implements AppointmentRepository {
  constructor(databaseUrl: string);
  save(appointment: Appointment): Promise<void>;
}
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

// platform/composition/platform.ts, reduced: what every context receives
interface Platform {
  readonly commands: InMemoryCommandBus;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly databaseUrl: string;
}

// contexts/appointments/appointments.module.ts
export function appointmentsModule(platform: Platform): { name: string; useCases: readonly UseCaseDeclaration[] } {
  const appointments = new KnexAppointmentRepository(platform.databaseUrl);

  // ddd-ts-kit:registrations
  platform.commands.register(BookAppointment, new BookAppointmentHandler(appointments, platform.clock, platform.ids), {
    context: 'appointments',
  });
  // /ddd-ts-kit:registrations

  return {
    name: 'appointments',
    useCases: [requires(BookAppointment, appointmentsPermissions['appointment.book'])],
  };
}
```

Here the compiler checks the arguments of each `new`, and nothing else. A use case missing
from `useCases` is found by `ddd-ts-kit check` (`authz/declared` reads the module file); a
handler that is never registered is found by the first command that reaches no handler, not at
start.

**In a test**, a module of `@ddd-ts-kit/di` (declared or explicit) runs as it is, with a fake
bound under the port class, a frozen clock and sequential identifiers:

<!-- checked sample -->
```ts
import { anActor } from '@ddd-ts-kit/auth/testing';
import { AuthorizedCommand, Clock, IdGenerator, type Actor, type CommandHandler } from '@ddd-ts-kit/kernel';
import { createTestApplication, defineContextModule, fake } from '@ddd-ts-kit/di';
import { expect, it } from 'vitest';

// the port, the command and the handler of the first sample, in a few lines
type Appointment = { readonly id: string; readonly bookedAt: Date };
abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}
class BookAppointment extends AuthorizedCommand<string> {}
class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(): Promise<string> {
    const appointment = { id: this.ids.next(), bookedAt: this.clock.now() };
    await this.appointments.save(appointment);

    return appointment.id;
  }
}
const appointmentsModule = defineContextModule({
  name: 'appointments',
  register(builder) {
    builder.command(BookAppointment).public().handledBy(BookAppointmentHandler, [AppointmentRepository, Clock, IdGenerator]);
  },
});

// contexts/appointments/test/fakes/in-memory-appointment.repository.ts: a fake implements the port
class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly saved: Appointment[] = [];

  async save(appointment: Appointment): Promise<void> {
    this.saved.push(appointment);
  }
}

// contexts/appointments/test/unit/book-appointment.handler.spec.ts
it('books the appointment at the instant of the clock, under a new id', async () => {
  const appointments = new InMemoryAppointmentRepository();
  const app = createTestApplication({
    modules: [appointmentsModule],
    fakes: [fake(AppointmentRepository, appointments)],
    now: new Date('2026-03-02T08:00:00.000Z'),
  });
  const client: Actor = anActor().named('ada').build();

  const id = await app.commandBus.execute(new BookAppointment(client));

  expect(id).toBe('id-1');
  expect(appointments.saved).toEqual([{ id: 'id-1', bookedAt: new Date('2026-03-02T08:00:00.000Z') }]);
});
```

`fake(AppointmentRepository, appointments)` does not compile when `appointments` lacks a method
of the port. Manual wiring has no container to bind a fake in: its specs build the handler
with `new` and register it on `createTestBuses()` of `@ddd-ts-kit/testing`.

When several specs of a context build the same application, or the same buses, with the same
fakes, `npx ddd-ts-kit generate test-world <context>` writes that arrangement once, in
`test/worlds/`: see [Worlds](../concepts/testing-strategy.md#worlds).

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

The checks above catch each mistake at the earliest of four moments; only a dependency
resolved inside a factory waits for the first message that builds the class:

![Four moments of the declared style, from the source to a running application: the compiler checks dependency lists and port implementations, loading the classes checks the declarations, createApplication checks the bindings and the authorization, and the first message builds the handler](../assets/diagrams/dependency-injection-when-mistakes-are-found.svg)

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

![A decision tree: NestJS already the framework leads to its container; a policy against low-activity dependencies or a very small service leads to manual wiring; otherwise tsyringe with the declared style, assembled from a barrel when the application is bundled, and with an explicit module for a context whose wiring is unusual](../assets/diagrams/dependency-injection-choosing.svg)

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
