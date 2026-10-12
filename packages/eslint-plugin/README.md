# @ddd-ts-kit/eslint-plugin

AST-accurate ESLint rules for the architecture of [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md):
layer and context boundaries, purity of the domain and the application, clean code ordering,
layout and file shape, tactical DDD shapes, ports as abstract classes, scheduled jobs, and the
declarations of a declared-style project. Flat config only, ESLint 9
and 10.

Every rule reads `ddd-ts-kit.config.json` ([docs/CONFIG.md](../../docs/CONFIG.md)), found by
walking up from the linted file, and classifies the file into context and layer exactly like
`ddd-ts-kit check` does. It also reads `stack.style` there: see [The two styles](#the-two-styles).

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
| `@eslint/js` recommended | the baseline of ESLint |
| typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` | with `projectService`; `strict` and `stylistic` when `typeChecked` is `false` |
| `ddd-ts-kit/clean-code` | the standard rules backing section 6 of the architecture reference (below) |
| `ddd-ts-kit/architecture` | every rule of this plugin, at the severity of `rules.<id>` in `ddd-ts-kit.config.json`, else at its default, the two layout rules of `@stylistic/eslint-plugin` at the severity of `rules."clean/blank-lines"` and `curly` at the severity of `rules."clean/braces"` (default `error`) |
| `ddd-ts-kit/scripts` | `curly` on `.js`, `.mjs` and `.cjs` files, at the severity of `rules."clean/braces"`: a branch reads the same in a script |
| `ddd-ts-kit/inner-layers` | `no-param-reassign` with `props` in `domain/` and `application/`: no output argument |
| `ddd-ts-kit/aggregates` | `prefer-readonly` off in aggregates and entities, whose state is replaced by intention methods |
| `ddd-ts-kit/tests` | a lighter set for specs, fakes and builders |

| Option | Default | Meaning |
|---|---|---|
| `tsconfigRootDir` | the working directory | directory of the tsconfig and of `ddd-ts-kit.config.json` |
| `typeChecked` | `true` | add the rules that read types; `false` is faster and needs no tsconfig |
| `allowDefaultProject` | `['*.config.ts', '*.config.mts']` | files outside the tsconfig still linted with types |
| `ignores` | none | added to `dist`, `coverage`, `node_modules`, `reports`, `*.d.ts` |

To compose a config by hand, the plugin is the default export, with two presets that hold only
its own rules, the three typescript-eslint rules they delegate to and the four layout rules of
`@stylistic/eslint-plugin`, without type information:

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
| [`clean/blank-lines`](docs/rules/clean-blank-lines.md) | two `@stylistic/*` rules (`standardRules.layout`) | a blank line before every `return` and between logical blocks, around a method; fixable | `error` | standard |
| [`clean/braces`](docs/rules/clean-braces.md) | `curly` (`standardRules.braces`) | every `if`, `else`, `for`, `while` and `do` has braces; fixable | `error` | standard |
| [`clean/formatted`](docs/rules/clean-formatted.md) | none: Biome (`npm run format:check`) | every file is laid out by the formatter, at a line width of 120 | none | formatter |
| [`domain/aggregate-encapsulation`](docs/rules/domain-aggregate-encapsulation.md) | `ddd-ts-kit/domain-aggregate-encapsulation` | aggregates and entities: no public constructor, no public mutable property, no setter | `error` | custom |
| [`domain/value-object-immutability`](docs/rules/domain-value-object-immutability.md) | `ddd-ts-kit/domain-value-object-immutability` | value objects: every property `readonly`, no setter, no write to `this` | `error` | custom |
| [`domain/no-generic-error`](docs/rules/domain-no-generic-error.md) | `ddd-ts-kit/domain-no-generic-error` | no `throw new Error(...)` in `domain/` and `application/` | `error` | custom |
| [`errors/through-factory`](docs/rules/errors-through-factory.md) | `ddd-ts-kit/errors-through-factory` | under `"stack.refusals": "factories"`, no `new` of a class imported from `domain/errors/`: a refusal is built by a static factory of its concept class | `error` | custom |
| [`errors/constructor-not-public`](docs/rules/errors-constructor-not-public.md) | `ddd-ts-kit/errors-constructor-not-public` | under `"stack.refusals": "factories"`, an error class of `domain/errors/` has no public constructor, declared or inherited from `DomainError` | `error` | custom |
| [`errors/factory-name`](docs/rules/errors-factory-name.md) | `ddd-ts-kit/errors-factory-name` | under `"stack.refusals": "factories"`, a factory is not named `create`, `make`, `of` or `error1`, and its code is its name in constant case, alone or with the name of the concept | `error` | custom |
| [`application/handler-shape`](docs/rules/application-handler-shape.md) | `ddd-ts-kit/application-handler-shape` | a `*.handler.ts` exports one class whose single public method is `execute` | `error` | custom |
| [`application/command-query-separation`](docs/rules/application-command-query-separation.md) | `ddd-ts-kit/application-command-query-separation` | nothing under `application/queries` calls `save`, `delete`, `publish` on a dependency | `warn` | custom |
| [`domain-events/dispatched-on-save`](docs/rules/domain-events-dispatched-on-save.md) | `ddd-ts-kit/domain-events-dispatched-on-save` | no `pullEvents()` in `application/` and `infrastructure/`; no `DomainEventDispatcher` imported, listed as a dependency or received by a constructor in `application/commands`, `application/queries` and a repository adapter | `error` | custom |
| [`domain-events/transactional-before-commit`](docs/rules/domain-events-transactional-before-commit.md) | `ddd-ts-kit/domain-events-transactional-before-commit` | a class carrying `@DomainEventHandler` without `phase: 'after-commit'` depends on no `Cache`, `Lock`, `RateLimiter`, `JobScheduler` or `EventBus` of the kernel and on nothing imported from `infrastructure/`, another context, the platform or a package other than `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth`; an after-commit handler does not depend on `IntegrationEventPublisher`. The adapters of an `application/ports/` port and the phase of an explicit-style handler are held by the CLI checker | `error` | custom |
| [`test/no-mocks`](docs/rules/test-no-mocks.md) | `ddd-ts-kit/test-no-mocks` | no `vi.mock`, `vi.fn`, `vi.spyOn`, their `jest` twins or a mocking library in a context's tests | `warn` | custom |
| [`events/name-format`](docs/rules/events-name-format.md) | `ddd-ts-kit/events-name-format` | event names follow `<context>.<aggregate>.<fact>` in kebab-case | `error` | custom |
| [`events/outbox-required`](docs/rules/events-outbox-required.md) | `ddd-ts-kit/events-outbox-required` | no broker client and no concrete bus in `domain/` and `application/`; a publisher depends on the `IntegrationEventPublisher` port | `error` | custom |
| [`events/consumer-idempotent`](docs/rules/events-consumer-idempotent.md) | `ddd-ts-kit/events-consumer-idempotent` | a consumer is declared with a `consumer` name and a processed-event store, never by a bare `subscribe`; in the declared style `@IntegrationEventHandler` writes its `consumer` as a string literal | `error` | custom |
| [`context/extractable`](docs/rules/context-extractable.md) | `ddd-ts-kit/context-extractable` | no schema or table of another context, no exported mutable state, nothing of another context wired in the module and, in the declared style, no port of another context imported by a role file | `error` | custom |
| [`authz/declared`](docs/rules/authz-declared.md) | `ddd-ts-kit/authz-declared` | a registered command or query says `.requires(...)` or `.public()`, or its class carries `@Requires` or `@Public` (required on every message of the declared style), a route declares `security`, an authorized message forwards its actor | `error` | custom |
| [`authz/in-application`](docs/rules/authz-in-application.md) | `ddd-ts-kit/authz-in-application` | no role test in `presentation/`, no authorization in `infrastructure/`, no actor, session, execution context or rights in `domain/`; in the declared style `Requires`, `Public`, `Policy` and the `Access` port stay in `application/` | `error` | custom |
| [`authz/actor-explicit`](docs/rules/authz-actor-explicit.md) | `ddd-ts-kit/authz-actor-explicit` | no `ExecutionScope`, `ActorContext` (type or value: the class is the token) or `AsyncLocalStorage`, no read of the ambient context, no `stampCreation`, `stampUpdate` or `tenantScopeOf` in `domain/` and `application/` | `error` | custom |
| [`aspects/outside-in`](docs/rules/aspects-outside-in.md) | `ddd-ts-kit/aspects-outside-in` | `@ddd-ts-kit/aspects/decorators` is imported only in `infrastructure/` and in the platform | `error` | custom |
| [`tracing/platform-only`](docs/rules/tracing-platform-only.md) | `ddd-ts-kit/tracing-platform-only` | `@ddd-ts-kit/tracing` and `@opentelemetry/*` are imported only by the platform directory, `main.ts` and `apps/` | `error` | custom |
| [`standard/no-parallel-interface`](docs/rules/standard-no-parallel-interface.md) | `ddd-ts-kit/standard-no-parallel-interface` | no declared `ILogger`, `UserContext`, `PaginatedResult`, `CronJob`, `ErrorTracker` and the like next to the standard interfaces of the kernel (`standardInterfaces` in the config) | `warn` | custom |
| [`governance/recorded-deviation`](docs/rules/governance-recorded-deviation.md) | `ddd-ts-kit/governance-recorded-deviation` | every suppression names its rules and points to `ADR-<number>` after `--` | `error` | custom |
| [`declarations/role-declared`](docs/rules/declarations-role-declared.md) | `ddd-ts-kit/declarations-role-declared` | declared style only: a role file exports a class carrying the decorator of its role, the `consumer` and `name` of a declaration are string literals, a domain event handler names its event as the event does, `domain/` carries no declaration decorator | `error` | custom |
| [`declarations/constructor-injection`](docs/rules/declarations-constructor-injection.md) | `ddd-ts-kit/declarations-constructor-injection` | declared style only: a class whose decorator lists no dependency types each constructor parameter by one class, with no `?`, default value, rest or destructuring; under `stack.dependencies: signature` a decorator carries no list (a list that repeats the constructor is removed by the fix, one that differs is reported) | `error` | custom |
| [`ports/abstract-class`](docs/rules/ports-abstract-class.md) | `ddd-ts-kit/ports-abstract-class` | a port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) is an abstract class with abstract members only, never an interface | `error` | custom |
| [`ports/implements-never-extends`](docs/rules/ports-implements-never-extends.md) | `ddd-ts-kit/ports-implements-never-extends` | an adapter (`@Repository`, `@Gateway`, `@Adapter`, `bind(Port).toClass(Class)`) implements its port and never extends it | `error` | custom |
| [`ports/no-token-constant`](docs/rules/ports-no-token-constant.md) | `ddd-ts-kit/ports-no-token-constant` | a dependency is named by its port class: no token helper, symbol, string or constant, no token file | `error` | custom |
| [`ports/no-concrete-dependency`](docs/rules/ports-no-concrete-dependency.md) | `ddd-ts-kit/ports-no-concrete-dependency` | a dependency list names nothing imported from `infrastructure/` or `test/fakes/`, and no constructor parameter of a declared class that lists nothing is typed by such a class | `error` | custom |
| [`ports/value-import`](docs/rules/ports-value-import.md) | `ddd-ts-kit/ports-value-import` | a port named in a dependency list or given to `bind` is not a type-only import; fixable | `error` | custom |
| [`scheduling/job-triggers-use-case`](docs/rules/scheduling-job-triggers-use-case.md) | `ddd-ts-kit/scheduling-job-triggers-use-case` | a job lives in `application/scheduling/*.job.ts`, implements `ScheduledJob`, sends a command, and touches neither a repository nor the model | `error` | custom |
| [`scheduling/job-name`](docs/rules/scheduling-job-name.md) | `ddd-ts-kit/scheduling-job-name` | a job is named `<context>.<job-name>` by a string literal, and its `systemActor` carries that name | `error` | custom |
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
namespace (`declarations.Repository`) too. Three checks look at a class of another file (the
message a module registers, the event a `@DomainEventHandler` names, the class given to `toClass`): the import is resolved
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
| `no-extraneous-class` | empty classes allowed | a domain service or a fake starts empty |
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
`governance/recorded-deviation` asks that the reason point to a decision record (`ADR-<number>`).

## With `ddd-ts-kit check`

Two tools, one set of ids, no overlap of authority.

| Concern | Authority | Why |
|---|---|---|
| imports and boundaries (`layer/*`, `context/published-language-only`, `context/declared-relationship`, `context/published-language-is-a-contract`), `purity/*`, `clean/*`, `test/no-mocks`, `events/name-format`, `domain/*`, `application/*`, the code side of `events/outbox-required`, `events/consumer-idempotent`, `context/extractable`, `authz/*`, `aspects/outside-in`, `tracing/platform-only`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit` on a declared class, `standard/no-parallel-interface`, `declarations/role-declared`, `ports/*`, `scheduling/*` (but the uniqueness of job names) and `governance/recorded-deviation` | this plugin | it reads the syntax tree: no false positive from a string or a comment, shadowing and arrow functions are understood |
| the tree (`tree/closed`, `tree/context-doc`), names and files (`naming/*`, `test/spec-required`, `test/builder-required`), the language (`language/*`), the config (`config/*`, `context/no-cycle`), `events/defined-in-published-language`, `composition/only-in-module`, `declarations/barrel-current`, unique consumer names and job names, one declared class per role file, of `domain-events/transactional-before-commit` the adapters of an `application/ports/` port and the phase of an explicit-style handler, the config side of the ids above (`stack.events`, lowered severities, that a decision record exists) | `ddd-ts-kit check` | they judge the project, the glossary and files that are not sources; ESLint judges one source at a time |
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
