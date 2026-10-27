---
name: wiring
description: >-
  Explains how the classes of a bounded context reach the composition root in a ddd-ts-kit
  project. Ports as abstract classes used as injection tokens, the declared style
  (decorators of the kernel, dependencies stated by the constructor signature, generated
  declarations per layer) or the explicit module file, values bound in the platform, fakes in tests. Use
  when binding an adapter to a port, adding a dependency to a handler, replacing an adapter
  by a fake, composing main.ts, or when a WiringError, DeclarationError, ports/*,
  declarations/* or composition/only-in-module is reported.
allowed-tools:
  - Read
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit docs)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
---

# Wiring

`stack.style` in `ddd-ts-kit.config.json` says which style the project uses. Exact API:
README of `@ddd-ts-kit/di`. The generators write all of this; read here what to do when you
change it by hand.

## Ports, in both styles

- A port is an **abstract class with abstract members only**, one per file:
  `domain/repositories/<name>.repository.ts` (extends the kernel `Repository<Aggregate>`) or
  `application/ports/<name>.port.ts`. The class is the contract **and** the injection token:
  no constant, no `token()`, no `*.ports.ts` file (`ports/abstract-class`,
  `ports/no-token-constant`).
- An adapter `implements` its port, never `extends` it (`ports/implements-never-extends`).
- A class of `infrastructure/` that implements a port is wired, by its declaration or by a
  binding in the composition root; one kept unwired on purpose says so above the class,
  `// ddd-ts-kit-disable-next-line declarations/port-adapter-wired -- ADR-NNNN: <why>`, with its
  decision record in `docs/adr/` (`declarations/port-adapter-wired`).
- A dependency is named by the class of its port, never by an adapter or a fake
  (`ports/no-concrete-dependency`). Where a list is written (the explicit style, a
  `bind(Port)`), the port is imported as a value (`ports/value-import`).
- A value that is not a port (settings, a database handle) is carried the same way: an
  abstract class with readonly members, bound to a plain object in the platform.
- A fake of `test/fakes/` is bound in tests only. An outside system the application runs
  without (a sandbox, a demo) gets a simulated adapter instead,
  `npx ddd-ts-kit generate adapter <ctx> <Port> --kind simulated`: production code under
  `infrastructure/external/`, bound to the port like any adapter (kind `external`). A port has
  one adapter, so the simulated one and the remote one take turns; nothing picks one per
  environment.

## Declared style (default with tsyringe)

A class says what it is on its own file, and that is its registration. There is no
`<context>.module.ts`.

| Class | Decorator of `@ddd-ts-kit/kernel/declarations` |
|---|---|
| command, query | `@Requires(permission)` or `@Public()` |
| handler | `@CommandHandler(Message)`, `@QueryHandler(Message)` |
| reaction to a domain event, publisher | `@DomainEventHandler(Event)`, attached under the `static readonly eventName` of the event class; `{ phase: 'after-commit' }` for an effect outside the transaction (never a publisher) |
| integration event handler | `@IntegrationEventHandler(definition, { consumer })` |
| scheduled job | `@Scheduled('<context>.<job>', { every } or { cron, timeZone })` |
| projector of a read model | `@Projection('<context>.<name>')`, with `@On(definition)` on each method that applies an event |
| policy | `@Policy(permission, { name })` |
| adapter | `@Repository(Port)`, `@Gateway(Port)`, `@Adapter(Port, { kind })` |

- Nothing under `domain/` carries a decorator. Names (`consumer`, `name`) are string literals.
- **The constructor states the dependencies, and nothing repeats it.** Each parameter is
  typed by one class, which is its token: a port, a kernel port (`Clock`, `CommandBus`,
  `Logger`...), another declared class, or an abstract class the platform binds to a value.
  Never a union, an interface, a primitive, `?`, a default value, a rest parameter
  (`declarations/constructor-injection`). A port that only types a parameter is imported with
  `import type`.
- To add a dependency to a handler: add the constructor parameter. Then `npx ddd-ts-kit docs`
  (`npm run dev` does it by itself on every reload). Nothing else, and no list in the
  decorator.
- Each layer holds a generated `<layer>.declarations.ts`
  (`application/application.declarations.ts`; a role folder holds its role files and nothing
  else): one `export *` per role file of the layer, then one
  `injected(Class, [Tokens])` per class whose constructor takes something, read from the source.
  `<context>.declarations.ts` only re-exports these files; the composition root imports it.
  After adding, moving or deleting a role file, or changing a constructor, by hand:
  `npx ddd-ts-kit docs`, which also deletes the declarations of an emptied layer
  (`declarations/barrel-current` names the file and the class whose list is stale). Never edit
  them. A context still declared as an earlier version wrote it (the single
  `<context>.declarations.ts` of 0.84, or one `<folder>.declarations.ts` per role folder as 0.85 and
  0.86 wrote them) is a warning of that rule in this version and an error in a later one: `npx ddd-ts-kit docs` moves it, and
  the moved files are committed together. With `stack.assembly: discovery` the composition root reads the role files
  itself (`discoverContext`) and the lists from the generated `<context>.dependencies.ts`.
- A context divided into modules of the model (`contexts.<name>.modules`) wires the same way:
  each layer of a module has its own declarations,
  `<module>/application/application.declarations.ts`, re-exported by
  `<context>.declarations.ts` like the others; `discoverContext` reads the modules in the
  generated `<context>.dependencies.ts`, which names them, without the config, and loads the role
  files of each module folder. A module never has a module file of its own. `npx ddd-ts-kit move-to-module` rewrites the declarations it moves.
- `WiringError MISSING_DEPENDENCIES` or `DEPENDENCY_ARITY` at startup: the generated file is
  stale or was not loaded. Run `npx ddd-ts-kit docs`; in a test, assemble the context from its
  generated file (`contextModule('<context>', declarations)`), never from a class imported
  alone.
- Compiler metadata is never used: `emitDecoratorMetadata` is absent with standard
  decorators and under `tsx`. Do not add `reflect-metadata` calls or `@Inject`.
- `stack.dependencies: listed` (a 0.1 project; what a config without the key means): the
  decorators list their dependencies, `@CommandHandler(Message, [Ports])`, in the order of the
  constructor. Keep the form the project uses; to move to signatures, set
  `"dependencies": "signature"`, `npx eslint . --fix`, `npx ddd-ts-kit docs`.
- A value or a factory, which no decorator can say, is bound in
  `src/platform/composition/platform.module.ts` (and its test twin): that file belongs to the platform,
  not to a context.

## Explicit style (NestJS, manual wiring, or by choice)

Every binding is written in `<context>.module.ts`, the only file of a context allowed to
know every layer (`composition/only-in-module`):
`builder.bind(Port).toClass(Adapter, [Ports]).as('<kind>')`,
`builder.command(Message).requires(permission).handledBy(Handler, [Ports])` (or `.public()`),
`builder.on(definition, { consumer }).handledBy(Handler, [Ports])`. Explicit stays explicit:
the list of each statement names the ports of the constructor, in order, and the compiler
checks it; nothing is read from signatures here. Generators add the lines between the
markers. With NestJS or manual wiring the rule is the same in another syntax;
keep `@Injectable()` out of `domain/` and `application/`. The rest of Nest's request pipeline
(controllers, guards, pipes, exception filters, interceptors) stays out of every context
(`nest/no-parallel-pipeline`): where each tool of Nest goes is in [nest.md](nest.md).

## Composition root

`src/main.ts` starts tracing first, loads the configuration, opens persistence, then calls
`composeApplication` of `src/platform/composition/compose-application.ts`, where each context is one line
(`contextModule('<context>', declarations)`, or the module of an explicit context) added by
`generate context`. Adapters are instantiated, and declarations assembled, nowhere else
(`composition/only-in-module`). `createApplication` refuses duplicate bindings, missing
dependencies and cycles before anything is instantiated: a `WiringError` names the port and
the module.

Controllers, guards, request mappers and serializers are declared classes too (`@Controller`,
`@Guard`, `@RequestMapper`, `@Serializer` of `@ddd-ts-kit/http`): the generated file of the
context exports them and registers what each constructor takes, and the composition root mounts
every controller with `controllerRoutes(resolve(DeclaredEdges).of('controller'), { resolve })`.
No file lists the routes of a declared context. In the explicit style the list of routes
builds each controller by hand: `...controllerRoutes([new IssueInvoiceController(commands)])`.

## Tests

```ts
const application = createTestApplication({
  modules: [platformTestModule, contextModule('ordering', orderingDeclarations)],
  fakes: [fake(OrderRepository, orders), fake(PaymentGateway, payments)],
});
```

The test application brings a fixed clock, sequential identifiers, in-memory buses, logger,
metrics and error reporter. Replace every adapter that leaves the process by its fake; never
mock a module. When several specs of a context share this arrangement,
`npx ddd-ts-kit generate test-world <ctx>` writes it once, in `test/worlds/`. Details: skill
`ddd-ts-kit:testing`.
