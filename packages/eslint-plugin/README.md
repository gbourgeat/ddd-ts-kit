**English** · [Français](README.fr.md)

# @ddd-ts-kit/eslint-plugin

AST-accurate ESLint rules for the architecture of [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md):
layer and context boundaries, purity of the domain and the application, clean code ordering,
layout and file shape, tactical DDD shapes, ports as abstract classes, scheduled jobs, and the
declarations of a declared-style project. Flat config only, ESLint 9
and 10.

Every rule reads `ddd-ts-kit.config.json` ([docs/CONFIG.md](../../docs/CONFIG.md)), found by
walking up from the linted file, and classifies the file into context and layer exactly like
`ddd-ts-kit check` does. It also reads `stack.style` there: see [The two styles](#the-two-styles).

![ESLint hands the plugin a file; the plugin walks up to ddd-ts-kit.config.json, classifies the file as ddd-ts-kit check does (context billing, layer application, not a test file), runs each rule on its syntax tree at the severity the config gives its id, and reports the line, the problem, what to write instead and the rule](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/eslint-plugin-how-a-file-is-judged.svg)

## Install

```
npm i -D @ddd-ts-kit/eslint-plugin eslint @eslint/js typescript-eslint
```

`@stylistic/eslint-plugin` (5.x) comes with the plugin as a dependency: the presets use it for the
layout rules, and nothing has to be installed for it.

## Use

```js
import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

export default dddTsKit({ tsconfigRootDir: import.meta.dirname });
```

`dddTsKit(options)` returns a complete flat config array:

| Layer of the config | Content |
|---|---|
| `ddd-ts-kit/ignores` | what is never linted: see `ignores` below |
| `@eslint/js` recommended | the baseline of ESLint |
| typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` | with `projectService` (`ddd-ts-kit/type-information`), and without type checking on JavaScript files (`ddd-ts-kit/javascript`); `strict` and `stylistic` when `typeChecked` is `false` |
| `ddd-ts-kit/clean-code` | the standard rules backing section 6 of the architecture reference (below) |
| `ddd-ts-kit/architecture` | every rule of this plugin, at the severity of `rules.<id>` in `ddd-ts-kit.config.json`, else at its default, the two layout rules of `@stylistic/eslint-plugin` at the severity of `rules."clean/blank-lines"` and `curly` at the severity of `rules."clean/braces"` (default `error`) |
| `ddd-ts-kit/scripts` | `curly` on `.js`, `.mjs` and `.cjs` files, at the severity of `rules."clean/braces"`: a branch reads the same in a script |
| `ddd-ts-kit/inner-layers` | `no-param-reassign` with `props` in `domain/` and `application/`: no output argument |
| `ddd-ts-kit/aggregates` | `prefer-readonly` off in aggregates and entities, whose state is replaced by intention methods |
| `ddd-ts-kit/tests` | a lighter set on `*.spec.ts`, `*.test.ts`, the `test/` directory of each context and the root `test/`: `any` and `!` warn, the `no-unsafe-*` rules off, type assertions allowed |

| Option | Default | Meaning |
|---|---|---|
| `tsconfigRootDir` | the working directory | directory of the tsconfig and of `ddd-ts-kit.config.json` |
| `typeChecked` | `true` | add the rules that read types; `false` is faster and needs no tsconfig |
| `allowDefaultProject` | `['*.config.ts', '*.config.mts']` | files outside the tsconfig still linted with types |
| `ignores` | none | added to `dist`, `coverage`, `node_modules`, `reports`, `*.d.ts`, and `clients/*/src` when `ddd-ts-kit.config.json` has `"sdk"` (the clients the CLI generates) |

Blocks are applied in this order, and a later block wins for the files it matches. A block of
your own goes after the helper:

```js
import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

export default [
  ...dddTsKit({ tsconfigRootDir: import.meta.dirname, ignores: ['src/generated/**'] }),
  // a rule the kit does not enable: purity/no-environment refuses console in domain/ and application/ only
  { files: ['src/**/*.ts'], rules: { 'no-console': 'error' } },
];
```

To compose a config by hand, the plugin is the default export, with two presets that hold only
its own rules, the three typescript-eslint rules they delegate to, the two layout rules of
`@stylistic/eslint-plugin` and `curly`, without type information:

```js
import dddTsKit from '@ddd-ts-kit/eslint-plugin';

export default [...dddTsKit.configs.recommended]; // or configs.strict: every rule at error
```

The standard rule sets of the helper are exported as `standardRules` (`escapeHatch`, `cleanCode`,
`typedCleanCode`, `kitConventions`, `layout`, `braces`). `standardRules.braces` holds `curly` for
[`clean/braces`](docs/rules/clean-braces.md); `standardRules.layout` holds the two
`@stylistic/*` rules of [`clean/blank-lines`](docs/rules/clean-blank-lines.md) at `error`; a config
composed by hand registers the plugin under `@stylistic` next to them:

```js
import stylistic from '@stylistic/eslint-plugin';
import dddTsKit, { standardRules } from '@ddd-ts-kit/eslint-plugin';

export default [{ files: ['**/*.ts'], plugins: { 'ddd-ts-kit': dddTsKit, '@stylistic': stylistic }, rules: standardRules.layout }];
```

### Changing a severity

The severity of a rule of the kit is written once, in `ddd-ts-kit.config.json`, where both
tools read it:

```json
{
  "rules": {
    "clean/function-size": "error",
    "test/no-mocks": "off"
  }
}
```

```js
// instead of: a severity in eslint.config.mjs, which `ddd-ts-kit check` never sees
export default [...dddTsKit(), { rules: { 'ddd-ts-kit/test-no-mocks': 'off' } }];
```

`"off"` in the config silences the rule even where an ESLint config enables it. Raising a
severity is free; lowering one under its default (`off`, or `warn` for an `error` rule) is a
deviation, and `ddd-ts-kit check` asks for its decision record: see
[Deviations](../../docs/CONFIG.md#deviations).

A severity for some files only is written the same way, with the files it is for:
`"clean/stepdown": { "severity": "off", "files": ["src/contexts/ledger/infrastructure/legacy/**"] }`.
The preset gives it a block of its own after `ddd-ts-kit/architecture`, named
`ddd-ts-kit/rules/<id>`, whose `files` are those globs: every other file keeps the severity of
the project, in ESLint as in `ddd-ts-kit check`.

## A report, and what to write instead

Every message says what is wrong, what to write instead, and the rule. A handler that reads the
system clock, in `src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts`:

```ts
// instead of
import type { IdGenerator } from '@ddd-ts-kit/kernel';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';
import type { IssueInvoice } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';

export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const id = this.ids.next();

    await this.invoices.save(Invoice.issue(id, command.customerId, new Date()));

    return id;
  }
}
```

is reported, by `npx eslint src`:

```
src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
  16:68  error  new Date() without argument is used in the application layer. Receive the instant as a parameter in the domain, and take it from the Clock port (`this.clock.now()`) in a handler, so that a test fixes time with FixedClock  ddd-ts-kit/purity-no-system-clock
```

The fix the message names: the `Clock` port, which a spec fixes with `FixedClock`.

<!-- checked sample -->
```ts
import { AuthorizedCommand, Clock, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';

// the command, the aggregate and its repository port, in their own files
declare class IssueInvoice extends AuthorizedCommand<string> {
  readonly customerId: string;
  constructor(actor: Actor, customerId: string);
}
declare class Invoice {
  static issue(id: string, customerId: string, issuedAt: Date): Invoice;
}
declare abstract class InvoiceRepository {
  abstract save(invoice: Invoice): Promise<void>;
}

// write: the instant comes from a port
export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const id = this.ids.next();

    await this.invoices.save(Invoice.issue(id, command.customerId, this.clock.now()));

    return id;
  }
}
```

When the code is right and the rule is not, the deviation is recorded, not hidden: see the
suppression comment in [Settings](#settings).

## Rules

Ids are those of [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md); the ESLint name replaces the
slash by a dash (one exception: `clean-function-ceiling`, the part of `clean/function-size` that
is an error whatever the configured limit). `strict` sets every rule to `error`.

| Id | ESLint name | Holds | Default | Implementation |
|---|---|---|---|---|
| [`layer/domain-purity`](docs/rules/layer-domain-purity.md) | `ddd-ts-kit/layer-domain-purity` | `domain/` imports only its own domain, the shared kernel and the allowed packages; never `@ddd-ts-kit/aspects`, `audit`, `redis`, `scheduling`, `sentry` or `tracing`, even allowed, nor `@ddd-ts-kit/kernel/declarations` in the declared style | `error` | custom |
| [`layer/application-inward`](docs/rules/layer-application-inward.md) | `ddd-ts-kit/layer-application-inward` | `application/` never imports `infrastructure/`, `presentation/`, a framework, a driver or a package applying a concern from outside (`@ddd-ts-kit/aspects`, `audit`, `redis`, `scheduling`, `sentry`, `tracing`); `@ddd-ts-kit/kernel/declarations` is always allowed in the declared style | `error` | custom |
| [`layer/presentation-no-infrastructure`](docs/rules/layer-presentation-no-infrastructure.md) | `ddd-ts-kit/layer-presentation-no-infrastructure` | `presentation/` never imports `infrastructure/` | `error` | custom |
| [`layer/infrastructure-no-presentation`](docs/rules/layer-infrastructure-no-presentation.md) | `ddd-ts-kit/layer-infrastructure-no-presentation` | `infrastructure/` never imports `presentation/` | `error` | custom |
| [`context/published-language-only`](docs/rules/context-published-language-only.md) | `ddd-ts-kit/context-published-language-only` | another context is imported only through its `published-language/` | `error` | custom |
| [`context/declared-relationship`](docs/rules/context-declared-relationship.md) | `ddd-ts-kit/context-declared-relationship` | such an import needs the upstream declared in the config | `error` | custom |
| [`context/published-language-is-a-contract`](docs/rules/context-published-language-is-a-contract.md) | `ddd-ts-kit/context-published-language-is-a-contract` | `published-language/` imports only its allow-list and other published languages | `error` | custom |
| [`language/declared-vocabulary`](docs/rules/language-declared-vocabulary.md) | `ddd-ts-kit/language-declared-vocabulary` | a value of a closed vocabulary the project declares (an object `as const` with the union type of its name, a permission set) is read through it, never written again as a string, under `"stack.literals": "named"`; tests, published languages and, outside `domain/`, a word typed by another language excluded | `error` | custom |
| [`naming/business-name`](docs/rules/naming-business-name.md) | `ddd-ts-kit/naming-business-name` | a variable, parameter, property, destructured or loop binding of `domain/`, `application/` and the shared kernel is named after its concept, never `target`, `data`, `item` or another generic word (`words`, `allow`, `businessNames` of the config); fixable where the initializer names the concept | `error` | custom |
| [`purity/no-system-clock`](docs/rules/purity-no-system-clock.md) | `ddd-ts-kit/purity-no-system-clock` | no `new Date()`, `Date.now()`, `Date()`, `performance.now()` in `domain/` and `application/` | `error` | custom |
| [`purity/no-ambient-randomness`](docs/rules/purity-no-ambient-randomness.md) | `ddd-ts-kit/purity-no-ambient-randomness` | no `Math.random`, `crypto.randomUUID`, id library in `domain/` and `application/` | `error` | custom |
| [`purity/no-environment`](docs/rules/purity-no-environment.md) | `ddd-ts-kit/purity-no-environment` | no `process.env`, `console`, `fetch`, file system or network module in `domain/` and `application/` | `error` | custom |
| [`clean/stepdown`](docs/rules/clean-stepdown.md) | `ddd-ts-kit/clean-stepdown` | static factories, public members, then private ones; a function above the functions it calls | `error` | custom |
| [`clean/function-size`](docs/rules/clean-function-size.md) | `ddd-ts-kit/clean-function-size` | at most 3 parameters (constructors exempt) and 30 lines of code (configurable, never above 100) | `warn` | custom |
| [`clean/function-size`](docs/rules/clean-function-ceiling.md) (ceiling) | `ddd-ts-kit/clean-function-ceiling` | no function longer than 100 lines of code, `describe` callbacks and module files included | `error` | custom |
| [`clean/no-flag-argument`](docs/rules/clean-no-flag-argument.md) | `ddd-ts-kit/clean-no-flag-argument` | no boolean parameter on a public method of the domain or on `execute` | `warn` | custom |
| [`clean/no-commented-out-code`](docs/rules/clean-no-commented-out-code.md) | `ddd-ts-kit/clean-no-commented-out-code` | no comment that parses as code | `error` | custom |
| [`clean/no-noise-comment`](docs/rules/clean-no-noise-comment.md) | `ddd-ts-kit/clean-no-noise-comment` | no banner, journal, closing-brace label, empty tag, ownerless TODO, comment repeating a name | `warn` | custom |
| [`clean/no-escape-hatch`](docs/rules/clean-no-escape-hatch.md) | `ddd-ts-kit/clean-no-escape-hatch` | no type assertion outside mappers, infrastructure and the declared `adapterGlobs`, no `eslint-disable` without reason | `error` | custom, plus 3 standard rules (below) |
| [`clean/no-hash-private`](docs/rules/clean-no-hash-private.md) | `ddd-ts-kit/clean-no-hash-private` | a class member is `private`, never `#name`; fixable | `error` | custom |
| [`clean/one-export-per-file`](docs/rules/clean-one-export-per-file.md) | `ddd-ts-kit/clean-one-export-per-file` | one exported class, interface or function per source file, with the types of its signature, the file named after it; entry files only re-export | `error` | custom |
| [`clean/file-size`](docs/rules/clean-file-size.md) | `ddd-ts-kit/clean-file-size` | no file over 350 lines, tests included | `error` | custom |
| [`clean/no-magic-number`](docs/rules/clean-no-magic-number.md) | `ddd-ts-kit/clean-no-magic-number` | no number literal in `domain/` and `application/` but 0, 1, -1, an index, a type and the initializer of a module constant or a `static readonly`, under `"stack.literals": "named"` | `error` | custom |
| [`clean/blank-lines`](docs/rules/clean-blank-lines.md) | two `@stylistic/*` rules (`standardRules.layout`) | a blank line before every `return` and between logical blocks, around a method; fixable | `error` | standard |
| [`clean/braces`](docs/rules/clean-braces.md) | `curly` (`standardRules.braces`) | every `if`, `else`, `for`, `while` and `do` has braces; fixable | `error` | standard |
| [`clean/formatted`](docs/rules/clean-formatted.md) | none: Biome (`npm run format:check`) | every file is laid out by the formatter, at a line width of 120 | none | formatter |
| [`domain/aggregate-encapsulation`](docs/rules/domain-aggregate-encapsulation.md) | `ddd-ts-kit/domain-aggregate-encapsulation` | aggregates and entities: no public constructor, no public mutable property, no setter | `error` | custom |
| [`domain/value-object-immutability`](docs/rules/domain-value-object-immutability.md) | `ddd-ts-kit/domain-value-object-immutability` | value objects: every property `readonly`, no setter, no write to `this` | `error` | custom |
| [`domain/value-object-class`](docs/rules/domain-value-object-class.md) | `ddd-ts-kit/domain-value-object-class` | under `"stack.values": "classes"`: a value object file exports one class extending `ValueObject`, private or protected constructor, static factories, no function nor object literal; no exported function of `domain/` or of the shared kernel answers a record of data | `error` | custom |
| [`domain/no-generic-error`](docs/rules/domain-no-generic-error.md) | `ddd-ts-kit/domain-no-generic-error` | no `throw new Error(...)` in `domain/` and `application/` | `error` | custom |
| [`errors/through-factory`](docs/rules/errors-through-factory.md) | `ddd-ts-kit/errors-through-factory` | under `"stack.refusals": "named"` or `"factories"`, no `new` of a class imported from `domain/errors/`, nor under `named` of a class extending `DomainRefusal`: a refusal is built by a static factory of its class | `error` | custom |
| [`errors/constructor-not-public`](docs/rules/errors-constructor-not-public.md) | `ddd-ts-kit/errors-constructor-not-public` | under `"stack.refusals": "named"` or `"factories"`, an error class of `domain/errors/` has no public constructor, declared or inherited from `DomainError` | `error` | custom |
| [`errors/factory-name`](docs/rules/errors-factory-name.md) | `ddd-ts-kit/errors-factory-name` | under `"stack.refusals": "named"`, a refusal class is not named `...Error` and a factory starts with `for`, `with`, `because`, `on` or `at` then an upper-case letter, no digit; under `"factories"`, a factory is not named `create`, `make`, `of` or `error1`, and its code is its name in constant case, alone or with the name of the concept | `error` | custom |
| [`application/handler-shape`](docs/rules/application-handler-shape.md) | `ddd-ts-kit/application-handler-shape` | a `*.handler.ts` exports one class whose single public method is `execute` | `error` | custom |
| [`presentation/controller-shape`](docs/rules/presentation-controller-shape.md) | `ddd-ts-kit/presentation-controller-shape` | a `*.controller.ts` carrying `@Controller` exports one class whose single public method is `handle` | `error` | custom |
| [`presentation/controller-delegates`](docs/rules/presentation-controller-delegates.md) | `ddd-ts-kit/presentation-controller-delegates` | a controller is given the bus of its method, a request mapper and a serializer, nothing else | `error` | custom |
| [`presentation/guard-at-the-edge`](docs/rules/presentation-guard-at-the-edge.md) | `ddd-ts-kit/presentation-guard-at-the-edge` | a `*.guard.ts` imports nothing from `domain/` or `infrastructure/`, no repository, no unit of work, no command bus | `error` | custom |
| [`presentation/shared-cache-varies`](docs/rules/presentation-shared-cache-varies.md) | `ddd-ts-kit/presentation-shared-cache-varies` | a `public` cache policy of a route, a controller or a route group that knows its caller names in `vary` what its answer depends on | `error` | custom |
| [`application/command-query-separation`](docs/rules/application-command-query-separation.md) | `ddd-ts-kit/application-command-query-separation` | nothing under `application/queries` calls `save`, `delete`, `publish` on a dependency | `warn` | custom |
| [`domain-events/dispatched-on-save`](docs/rules/domain-events-dispatched-on-save.md) | `ddd-ts-kit/domain-events-dispatched-on-save` | no `pullEvents()` in `application/` and `infrastructure/`; no `DomainEventDispatcher` imported, listed as a dependency or received by a constructor in `application/commands`, `application/queries` and a repository adapter | `error` | custom |
| [`domain-events/transactional-before-commit`](docs/rules/domain-events-transactional-before-commit.md) | `ddd-ts-kit/domain-events-transactional-before-commit` | a class carrying `@DomainEventHandler` without `phase: 'after-commit'` depends on no `Cache`, `Lock`, `RateLimiter`, `JobScheduler` or `EventBus` of the kernel and on nothing imported from `infrastructure/`, another context, the platform or a package other than `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth`; an after-commit handler does not depend on `IntegrationEventPublisher`. The adapters of an `application/ports/` port and the phase of an explicit-style handler are held by the CLI checker | `error` | custom |
| [`event-sourcing/state-in-apply`](docs/rules/event-sourcing-state-in-apply.md) | `ddd-ts-kit/event-sourcing-state-in-apply` | an event-sourced aggregate changes its state only in its apply methods (`apply<Fact>`, `restore`), and an apply method records no event | `error` | custom |
| [`event-sourcing/past-tense`](docs/rules/event-sourcing-past-tense.md) | `ddd-ts-kit/event-sourcing-past-tense` | the events an event-sourced aggregate imports from `domain/events/` are named in the past tense | `error` | custom |
| [`event-sourcing/store-behind-repository`](docs/rules/event-sourcing-store-behind-repository.md) | `ddd-ts-kit/event-sourcing-store-behind-repository` | no `EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` in `domain/` and `application/`: the aggregate goes through its repository | `error` | custom |
| [`event-sourcing/projection-never-appends`](docs/rules/event-sourcing-projection-never-appends.md) | `ddd-ts-kit/event-sourcing-projection-never-appends` | a projection names no event store, and one fed by the store no repository: it never appends to a stream | `error` | custom |
| [`event-sourcing/upcaster-required`](docs/rules/event-sourcing-upcaster-required.md) | `ddd-ts-kit/event-sourcing-upcaster-required` | `defineStoredEvent` names the type of its data, declared in the file, and a version above 1 has an upcaster from each version below (the lock of recorded shapes: `ddd-ts-kit check`) | `error` | custom |
| [`test/no-mocks`](docs/rules/test-no-mocks.md) | `ddd-ts-kit/test-no-mocks` | no `vi.mock`, `vi.fn`, `vi.spyOn`, their `jest` twins or a mocking library in a context's tests | `warn` | custom |
| [`test/no-only-no-skip`](docs/rules/test-no-only-no-skip.md) | `ddd-ts-kit/test-no-only-no-skip` | no `.only` or `.skip` on a test or a group, no `fit`, `xit`, `xdescribe`, no `.skipIf` or `.runIf` on a constant: every test runs, or runs wherever its condition holds | `error` | custom |
| [`test/title-states-a-rule`](docs/rules/test-title-states-a-rule.md) | `ddd-ts-kit/test-title-states-a-rule` | the title of a test states the rule it proves, in lower case, after the rows and the criterion it cites; never `should`, `test`, `works`, nor a method or a class; a `describe` names the unit | `error` | custom |
| [`test/no-logic`](docs/rules/test-no-logic.md) | `ddd-ts-kit/test-no-logic` | no `if`, `switch`, ternary, loop or `try` in a test: a case per row is an `it.each`, a decision belongs to a builder, a fake or a helper | `error` | custom |
| [`test/assertion-present`](docs/rules/test-assertion-present.md) | `ddd-ts-kit/test-assertion-present` | every test asserts something: an `expect`, an `expect...` or `assert...` helper, or the outcome of a scenario (`thenEvents`, `thenError`); a test without a body is an `it.todo` | `error` | custom |
| [`test/refusal-by-code`](docs/rules/test-refusal-by-code.md) | `ddd-ts-kit/test-refusal-by-code` | a refusal is asserted by its code and its facts, never by `toThrow` with a message, a class or nothing | `error` | custom |
| [`test/no-snapshot`](docs/rules/test-no-snapshot.md) | `ddd-ts-kit/test-no-snapshot` | no snapshot matcher in a test: a test asserts the fields the rule depends on | `error` | custom |
| [`events/name-format`](docs/rules/events-name-format.md) | `ddd-ts-kit/events-name-format` | event names follow `<context>.<aggregate>.<fact>` in kebab-case | `error` | custom |
| [`events/outbox-required`](docs/rules/events-outbox-required.md) | `ddd-ts-kit/events-outbox-required` | no broker client and no concrete bus in `domain/` and `application/`; a publisher depends on the `IntegrationEventPublisher` port | `error` | custom |
| [`events/consumer-idempotent`](docs/rules/events-consumer-idempotent.md) | `ddd-ts-kit/events-consumer-idempotent` | a consumer is declared with a `consumer` name and a processed-event store, never by a bare `subscribe`; in the declared style `@IntegrationEventHandler` writes its `consumer` as a string literal | `error` | custom |
| [`context/extractable`](docs/rules/context-extractable.md) | `ddd-ts-kit/context-extractable` | no schema or table of another context, no exported mutable state, nothing of another context wired in the module and, in the declared style, no port of another context imported by a role file | `error` | custom |
| [`authz/declared`](docs/rules/authz-declared.md) | `ddd-ts-kit/authz-declared` | a registered command or query says `.requires(...)` or `.public()`, or its class carries `@Requires` or `@Public` (required on every message of the declared style), a route declares `security`, an authorized message forwards its actor | `error` | custom |
| [`authz/in-application`](docs/rules/authz-in-application.md) | `ddd-ts-kit/authz-in-application` | no role test in `presentation/`, no authorization in `infrastructure/`, no actor, session, execution context or rights in `domain/`; in the declared style `Requires`, `Public`, `Policy` and the `Access` port stay in `application/` | `error` | custom |
| [`authz/actor-explicit`](docs/rules/authz-actor-explicit.md) | `ddd-ts-kit/authz-actor-explicit` | no `ExecutionScope`, `ActorContext` (type or value: the class is the token) or `AsyncLocalStorage`, no read of the ambient context, no `stampCreation`, `stampUpdate` or `tenantScopeOf` in `domain/` and `application/` | `error` | custom |
| [`authz/fields-by-schema`](docs/rules/authz-fields-by-schema.md) | `ddd-ts-kit/authz-fields-by-schema` | no test on the roles of the actor, comparison with a role or `isAdmin` under `application/queries/`: a field reserved to some callers is marked with `withFieldAccess` | `error` | custom |
| [`aspects/outside-in`](docs/rules/aspects-outside-in.md) | `ddd-ts-kit/aspects-outside-in` | `@ddd-ts-kit/aspects/decorators` is imported only in `infrastructure/` and in the platform | `error` | custom |
| [`tracing/platform-only`](docs/rules/tracing-platform-only.md) | `ddd-ts-kit/tracing-platform-only` | `@ddd-ts-kit/tracing` and `@opentelemetry/*` are imported only by the platform directory, `main.ts` and `apps/` | `error` | custom |
| [`standard/no-parallel-interface`](docs/rules/standard-no-parallel-interface.md) | `ddd-ts-kit/standard-no-parallel-interface` | no declared `ILogger`, `UserContext`, `PaginatedResult`, `CronJob`, `ErrorTracker` and the like next to the standard interfaces of the kernel (`standardInterfaces` in the config) | `warn` | custom |
| [`governance/recorded-deviation`](docs/rules/governance-recorded-deviation.md) | `ddd-ts-kit/governance-recorded-deviation` | every suppression names its rules and points to `ADR-<number>` after `--` | `error` | custom |
| [`declarations/role-declared`](docs/rules/declarations-role-declared.md) | `ddd-ts-kit/declarations-role-declared` | declared style only: a role file exports a class carrying the decorator of its role, the `consumer` and `name` of a declaration are string literals, `domain/` carries no declaration decorator | `error` | custom |
| [`declarations/constructor-injection`](docs/rules/declarations-constructor-injection.md) | `ddd-ts-kit/declarations-constructor-injection` | declared style only: a class whose decorator lists no dependency types each constructor parameter by one class, with no `?`, default value, rest or destructuring; under `stack.dependencies: signature` a decorator carries no list (a list that repeats the constructor is removed by the fix, one that differs is reported) | `error` | custom |
| [`ports/abstract-class`](docs/rules/ports-abstract-class.md) | `ddd-ts-kit/ports-abstract-class` | a port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) is an abstract class with abstract members only, never an interface | `error` | custom |
| [`ports/implements-never-extends`](docs/rules/ports-implements-never-extends.md) | `ddd-ts-kit/ports-implements-never-extends` | an adapter (`@Repository`, `@Gateway`, `@Adapter`, `bind(Port).toClass(Class)`) implements its port and never extends it | `error` | custom |
| [`ports/no-token-constant`](docs/rules/ports-no-token-constant.md) | `ddd-ts-kit/ports-no-token-constant` | a dependency is named by its port class: no token helper, symbol, string or constant, no token file | `error` | custom |
| [`ports/no-concrete-dependency`](docs/rules/ports-no-concrete-dependency.md) | `ddd-ts-kit/ports-no-concrete-dependency` | a dependency list names nothing imported from `infrastructure/` or `test/fakes/`, and no constructor parameter of a declared class that lists nothing is typed by such a class | `error` | custom |
| [`ports/value-import`](docs/rules/ports-value-import.md) | `ddd-ts-kit/ports-value-import` | a port named in a dependency list or given to `bind` is not a type-only import; fixable | `error` | custom |
| [`scheduling/job-triggers-use-case`](docs/rules/scheduling-job-triggers-use-case.md) | `ddd-ts-kit/scheduling-job-triggers-use-case` | a job lives in `application/scheduling/*.job.ts`, implements `ScheduledJob`, sends a command, and touches neither a repository nor the model | `error` | custom |
| [`scheduling/job-name`](docs/rules/scheduling-job-name.md) | `ddd-ts-kit/scheduling-job-name` | a job is named `<context>.<job-name>` by a string literal, and its `systemActor` carries that name | `error` | custom |
| [`lifecycle/status-through-machine`](docs/rules/lifecycle-status-through-machine.md) | `ddd-ts-kit/lifecycle-status-through-machine` | in an aggregate that imports its state machine, the status is written only from the machine (`next`, `start`) or copied from a status already read | `error` | custom |
| [`process/sends-commands-only`](docs/rules/process-sends-commands-only.md) | `ddd-ts-kit/process-sends-commands-only` | a process manager of `application/processes/` imports no aggregate, entity, repository, domain service, port or infrastructure: it changes the world through the commands it decides | `error` | custom |
| [`schema/presentation-only`](docs/rules/schema-presentation-only.md) | `ddd-ts-kit/schema-presentation-only` | under `stack.schemas: shared`, a schema of the HTTP contract lives in `presentation/` of its context or of the shared kernel: the shared kernel imports no validation library outside `presentation/`, and no domain, application, infrastructure or published language imports a file of `presentation/` of the shared kernel | `error` | custom |
| [`imports/alias-only`](docs/rules/imports-alias-only.md) | `ddd-ts-kit/imports-alias-only` | a file of the project is imported by its alias (`@/...`, `$test/...`, `$scripts/...`), never by a relative path, the same directory included; no `.` or `..` segment in an alias path; fixable | `error` | custom |
| [`imports/extension`](docs/rules/imports-extension.md) | `ddd-ts-kit/imports-extension` | an import of a file of the project ends as `importExtension` of the config says: no extension under `none`, `.js` under `js`; fixable | `error` | custom |

`domain/*` and `application/*` ids are added by this plugin: the shape of a class needs a syntax
tree, so the CLI checker has no equivalent. The `domain-events/*` ids are not among them: both tools
hold them, and of `domain-events/transactional-before-commit` the checker alone holds what one file
does not show (where the adapters of an `application/ports/` port live, the phase an explicit-style
module file registers a handler in).

### The two styles

`stack.style` in `ddd-ts-kit.config.json` says how the contexts of the project are written:
`explicit`, every binding is written in `<context>.module.ts`; `declared`, each class says what
it is with a decorator of `@ddd-ts-kit/kernel/declarations` and there is no module file. A
config that does not say is `explicit`, and an explicit-style project is judged exactly as before
the declared style existed.

| Rule | Added in a declared-style project |
|---|---|
| `authz/declared` | an exported class of a `*.command.ts` or `*.query.ts` file carries `@Requires(...)` or `@Public()` |
| `authz/in-application` | `Requires`, `Public` and `Policy` are not imported in `presentation/` or `infrastructure/`, nor the ports `Access` and `PolicyAccess` in `infrastructure/` |
| `layer/application-inward` | `@ddd-ts-kit/kernel/declarations` is allowed whatever `applicationAllowedPackages` says |
| `layer/domain-purity` | `@ddd-ts-kit/kernel/declarations` is refused in `domain/` |
| `events/consumer-idempotent` | `@IntegrationEventHandler` writes its `consumer` as a non-empty string literal |
| `context/extractable` | a role file imports nothing from a port file of another context |
| `declarations/role-declared` | the whole rule |

One thing holds in both styles: a message class carrying `@Requires` or `@Public` is declared,
so a module that registers it without `.requires(...)` or `.public()` is not reported.

A decorator is read from the syntax tree and counts when its name is imported from
`@ddd-ts-kit/kernel/declarations` in the file, under an alias (`{ Repository as Repo }`) or a
namespace (`declarations.Repository`) too. Two checks look at a class of another file (the
message a module registers, the class given to `toClass`): the import is resolved
like any other, the file is read from disk and parsed without types, and nothing is concluded
when it cannot be. `stack.assembly` (`barrel` or `discovery`) is read with the style; no rule of
this plugin depends on it, since the barrel is a fact of the project that `ddd-ts-kit check`
holds (`declarations/barrel-current`).

### Standard rules instead of custom ones

Where a standard rule fully covers a part of the architecture reference, the presets enable it
and this plugin does not reimplement it.

| Architecture reference | Standard rule | Enabled by |
|---|---|---|
| `clean/no-escape-hatch`: explicit `any` | `@typescript-eslint/no-explicit-any` | `recommended`, `strict`, `dddTsKit()` |
| `clean/no-escape-hatch`: non-null assertion | `@typescript-eslint/no-non-null-assertion` | `recommended`, `strict`, `dddTsKit()` |
| `clean/no-escape-hatch`: `@ts-ignore`, `@ts-nocheck`, undescribed `@ts-expect-error` | `@typescript-eslint/ban-ts-comment` | `recommended`, `strict`, `dddTsKit()` |
| section 6, command or query and promises | `@typescript-eslint/no-floating-promises`, `no-misused-promises` | `dddTsKit()` with types |
| section 6, specific errors, exhaustive decisions | `@typescript-eslint/switch-exhaustiveness-check`, `no-unnecessary-condition` | `dddTsKit()` with types |
| section 6, immutability | `@typescript-eslint/prefer-readonly` | `dddTsKit()` with types |
| section 6, types | `@typescript-eslint/consistent-type-imports` | `dddTsKit()` |
| section 6, small functions | `complexity` (10, warn), `max-depth` (3, warn), `no-else-return` | `dddTsKit()` |
| section 6, no output argument | `no-param-reassign` (`props` in `domain/` and `application/`) | `dddTsKit()` |
| section 6, no surprise | `eqeqeq` | `dddTsKit()` |
| section 6, layout (`clean/blank-lines`) | `@stylistic/padding-line-between-statements`, `lines-between-class-members` | `recommended`, `strict`, `dddTsKit()` |
| section 6, layout (`clean/braces`) | `curly` (`all`) | `recommended`, `strict`, `dddTsKit()` |

`max-params`, `max-lines-per-function` and `max-lines` are deliberately not enabled:
`clean-function-size` exempts constructors and module files and reads `limits` from the config,
`clean-file-size` exempts generated files, which the standard rules cannot do, and both would
report the same thing twice. Layout is the opposite case: `clean/blank-lines` is entirely held by
`@stylistic/eslint-plugin` and `clean/braces` by `curly`, and this plugin writes no rule for them.
Where a token goes (indentation, quotes, line breaks, the padding of a block) is not linted at
all: the formatter of the project, Biome, owns it (`clean/formatted`), and no `@stylistic` rule
that would fight it is enabled.

### Where the kit and typescript-eslint strict disagree

`dddTsKit()` changes ten strict rules, each for a stated reason, so that freshly generated code
is not reported for following the conventions of the kit:

| Rule | Setting | Reason |
|---|---|---|
| `require-await` | off | a port is asynchronous by contract; an in-memory adapter has nothing to await |
| `no-unnecessary-type-arguments` | off | the id type of an aggregate is part of its declaration |
| `consistent-type-definitions` | off | props are type aliases, states and options are interfaces |
| `no-empty-object-type` | interfaces allowed | `interface SessionExtensions {}` is left open for declaration merging |
| `no-extraneous-class` | empty classes and decorated classes allowed | a domain service or a fake starts empty; a class that carries a decorator is a declaration, whatever its body |
| `no-unused-vars` | `args: 'none'` | an adapter implements the whole signature of its port |
| `dot-notation` | index signatures allowed | `process.env['PORT']` |
| `no-confusing-void-expression`, `restrict-template-expressions`, `restrict-plus-operands` | arrow shorthand, numbers and booleans allowed | not coercion bugs |

## Settings

`settings['ddd-ts-kit']` replaces what is read from disk, for tests and editors:

| Key | Meaning |
|---|---|
| `config` | the content of `ddd-ts-kit.config.json`, as an object |
| `rootDir` | the project root, when `config` is given (default: the working directory) |
| `filename` | posix path relative to the root, used instead of the real file name |

```ts
ruleTester.run('layer-domain-purity', rule, {
  valid: [],
  invalid: [
    {
      code: "import { z } from 'zod';",
      settings: { 'ddd-ts-kit': { config: {}, filename: 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts' } },
      errors: [{ messageId: 'package' }],
    },
  ],
});
```

The config file is read once per directory and per process: restart the ESLint server of the
editor after changing `ddd-ts-kit.config.json`.

Two things work as with the CLI checker: `rules.<id>: "off"` in the config silences the rule
even when the ESLint config enables it, and `// ddd-ts-kit-disable-next-line <id> -- <reason>`
silences one line for both tools. A suppression without a reason silences nothing, and
`governance/recorded-deviation` asks that the reason point to a decision record (`ADR-<number>`):

```ts
// instead of: a reason that points to no decision
// ddd-ts-kit-disable-next-line clean/no-flag-argument -- kept for now
cancel(force: boolean): void {
```

```
12:3  error  `ddd-ts-kit-disable-next-line clean/no-flag-argument` on line 12 silences a rule without pointing to a decision. Fix the diagnostic; if the deviation is deliberate, record it with `ddd-ts-kit generate adr` (reason, scope, condition for removing it) and end the comment with `-- ADR-<number>: <reason>`  ddd-ts-kit/governance-recorded-deviation
```

```ts
// write: the decision record says why, for what scope and until when
// ddd-ts-kit-disable-next-line clean/no-flag-argument -- ADR-0007: the legacy import sends a flag until 2027
cancel(force: boolean): void {
```

The id is the one of the architecture reference (`clean/no-flag-argument`), not the ESLint name,
and `npx ddd-ts-kit generate adr` writes the record. `eslint-disable` comments are held the same
way, by `clean/no-escape-hatch` and `governance/recorded-deviation`.

## With `ddd-ts-kit check`

Two tools, one set of ids, no overlap of authority. A third, dependency-cruiser, does not read the
config: it runs on a file generated from it, with its own rule names.

![The plugin and ddd-ts-kit check read ddd-ts-kit.config.json at run time and share its rule ids, severities and suppression comments: the plugin judges one source file at a time on its syntax tree and is right when it disagrees with the checker; the checker judges what spans files, the tree, names, glossaries, config and barrel; dependency-cruiser runs only on the .dependency-cruiser.cjs that depcruise-config --write generates from the config and judges the resolved import graph with its own rule names, always at severity error, ignoring suppression comments](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/eslint-plugin-two-tools.svg)

| Concern | Authority | Why |
|---|---|---|
| imports and boundaries (`layer/*`, `context/published-language-only`, `context/declared-relationship`, `context/published-language-is-a-contract`), `purity/*`, `clean/*`, `test/no-mocks`, the six rules on the shape of a test (`test/no-only-no-skip`, `test/title-states-a-rule`, `test/no-logic`, `test/assertion-present`, `test/refusal-by-code`, `test/no-snapshot`), `events/name-format`, `domain/*`, `application/*`, the code side of `events/outbox-required`, `events/consumer-idempotent`, `context/extractable`, `authz/*`, `aspects/outside-in`, `tracing/platform-only`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit` on a declared class, `event-sourcing/*` (but the lock of `event-sourcing/upcaster-required`), `standard/no-parallel-interface`, `declarations/role-declared`, `ports/*`, `scheduling/*` (but the uniqueness of job names), `language/declared-vocabulary`, `errors/through-factory`, `errors/constructor-not-public`, `errors/factory-name`, `presentation/*`, `lifecycle/*`, `process/*`, `schema/presentation-only`, `imports/alias-only`, `imports/extension` and `governance/recorded-deviation` | this plugin | it reads the syntax tree: no false positive from a string or a comment, shadowing and arrow functions are understood |
| the tree (`tree/closed`, `tree/context-doc`), names and files (`naming/*` but the code side of `naming/business-name`, which this plugin reads on the syntax tree and fixes, `test/spec-required`, `test/builder-required`), the language (`language/glossary-term`, `language/no-technical-name`), error codes (`errors/code-unique`, `errors/known-code`), `imports/alias-declared`, `schema/no-duplicate-shape`, the config (`config/*`, `context/no-cycle`), `events/defined-in-published-language`, `composition/only-in-module`, `declarations/barrel-current`, unique consumer names and job names, one declared class per role file, of `domain-events/transactional-before-commit` the adapters of an `application/ports/` port and the phase of an explicit-style handler, the config side of the ids above (`stack.events`, lowered severities, that a decision record exists) | `ddd-ts-kit check` | they judge the project, the glossary and files that are not sources; ESLint judges one source at a time |
| the real dependency graph (barrels, cycles, orphans, dev dependencies in production code) | dependency-cruiser, configured by the `.dependency-cruiser.cjs` that `ddd-ts-kit depcruise-config --write` generates from the config | it resolves modules instead of classifying paths |

The CLI keeps approximating the code-level rules with regular expressions, without dependency:
it is the guard that runs in an editor hook after each write. When both report the same id, fix
the code once; when they disagree, this plugin is right and the checker is to be fixed. A test
of this package pins the classification of files and imports against the CLI on the same sample
paths.

## TypeScript 7

typescript-eslint needs the JavaScript API of the compiler, which the native TypeScript 7 does
not ship (`typescript-eslint` 8.71 requires `typescript <6.1`). Keep both:

```json
{
  "devDependencies": {
    "typescript": "~6.0.3",
    "@typescript/native": "npm:typescript@~7.0.2"
  },
  "scripts": {
    "typecheck": "node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit",
    "lint": "eslint ."
  }
}
```

`typescript` 6 serves the tools that read sources through the compiler API (ESLint,
dependency-cruiser); the native 7 compiles and type-checks. Call the native compiler by its
path: both packages declare a `tsc` binary and `npx tsc` picks one of them.

## Development

```
node node_modules/@typescript/native/bin/tsc -b packages/eslint-plugin
npx vitest run packages/eslint-plugin
```

Rules are tested with `@typescript-eslint/rule-tester` wired to Vitest
(`test/support/rule-tester.ts`). A rule comes with valid and invalid cases, a message that says
what to do instead, and a page in `docs/rules/`. The package is held by its own rules through the
root `eslint.config.mjs`: one export per file, files named after their export, the layout rules.
