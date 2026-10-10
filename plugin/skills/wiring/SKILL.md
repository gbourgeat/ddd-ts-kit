---
name: wiring
description: >-
  Explains how the classes of a bounded context reach the composition root in a ddd-ts-kit
  project. Ports as abstract classes used as injection tokens, the declared style
  (decorators of the kernel and a generated barrel) or the explicit module file, values
  bound in the platform, fakes in tests. Use when binding an adapter to a port, adding a
  dependency to a handler, replacing an adapter by a fake, composing main.ts, or when a
  WiringError, DeclarationError, ports/*, declarations/* or composition/only-in-module is
  reported.
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
- A dependency list names port classes, in the order of the constructor, imported as values
  (`import { Clock }`, not `import type`): the compiler checks the list against the
  constructor (`ports/no-concrete-dependency`, `ports/value-import`).
- A value that is not a port (settings, a database handle) is carried the same way: an
  abstract class with readonly members, bound to a plain object in the platform.

## Declared style (default with tsyringe)

A class says what it is on its own file, and that is its registration. There is no
`<context>.module.ts`.

| Class | Decorator of `@ddd-ts-kit/kernel/declarations` |
|---|---|
| command, query | `@Requires(permission)` or `@Public()` |
| handler | `@CommandHandler(Message, [Ports])`, `@QueryHandler(Message, [Ports])` |
| reaction to a domain event, publisher | `@DomainEventHandler(Event, { name }, [Ports])` |
| integration event handler | `@IntegrationEventHandler(definition, { consumer }, [Ports])` |
| scheduled job | `@Scheduled('<context>.<job>', { every } or { cron, timeZone }, [CommandBus])` |
| policy | `@Policy(permission, { name })` |
| adapter | `@Repository(Port, [Ports])`, `@Gateway(Port, [Ports])`, `@Adapter(Port, { kind }, [Ports])` |

- Nothing under `domain/` carries a decorator. Names (`consumer`, `name`) are string literals.
- To add a dependency to a handler: add the constructor parameter and the port to the list,
  same position. Nothing else.
- The barrel `<context>.declarations.ts` holds one `export *` per role file. It is generated:
  after adding, moving or deleting a role file by hand, run `npx ddd-ts-kit docs`
  (`declarations/barrel-current`). Never edit it.
- A value or a factory, which no decorator can say, is bound in
  `src/platform/platform.module.ts` (and its test twin): that file belongs to the platform,
  not to a context.

## Explicit style (NestJS, manual wiring, or by choice)

Every binding is written in `<context>.module.ts`, the only file of a context allowed to
know every layer (`composition/only-in-module`):
`builder.bind(Port).toClass(Adapter, [Ports]).as('<kind>')`,
`builder.command(Message).requires(permission).handledBy(Handler, [Ports])` (or `.public()`),
`builder.on(definition, { consumer }).handledBy(Handler, [Ports])`. Generators add the lines
between the markers. With NestJS or manual wiring the rule is the same in another syntax;
keep `@Injectable()` out of `domain/` and `application/`.

## Composition root

`src/main.ts` starts tracing first, loads the configuration, opens persistence, then calls
`composeApplication` of `src/platform/compose-application.ts`, where each context is one line
(`contextModule('<context>', declarations)`) added by `generate context`. Adapters are
instantiated nowhere else. `createApplication` refuses duplicate bindings, missing
dependencies and cycles before anything is instantiated: a `WiringError` names the port and
the module.

## Tests

```ts
const application = createTestApplication({
  modules: [platformTestModule, contextModule('ordering', orderingDeclarations)],
  fakes: [fake(OrderRepository, orders), fake(PaymentGateway, payments)],
});
```

The test application brings a fixed clock, sequential identifiers, in-memory buses, logger,
metrics and error reporter. Replace every adapter that leaves the process by its fake; never
mock a module. Details: skill `ddd-ts-kit:testing`.
