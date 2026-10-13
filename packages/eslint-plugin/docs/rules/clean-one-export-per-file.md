**English** · [Français](clean-one-export-per-file.fr.md)

# ddd-ts-kit/clean-one-export-per-file

Architecture id: `clean/one-export-per-file`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: sources under the source root (in a workspace, under the `src` directory of a package). Tests (`*.spec.ts`, `*.test.ts`, a `test/` directory) and declaration files are not judged.

## Why

A file that exports one thing is found by its name, read in one sitting and moved without untangling. The companions it may keep are the types of its own signature: they have no life without it. Entry files are the opposite: they declare nothing, so that the map of a package stays a map.

## Reported

- a file exporting two or more classes, interfaces or functions that are not one thing (the allowances are below)
- a file not named after its export in kebab-case
- in an entry file (`index.ts` at any depth, `<context>.declarations.ts`, the files of the option `entries`): any statement that is not a re-export

Incorrect:

```ts
// src/platform/collaborators.ts
export function loggerOr(given?: Logger): Logger {}
export function clockOr(given?: Clock): Clock {}

// src/platform/event-bus.ts
export class RabbitMqEventBus {}

// src/platform/index.ts
export const VERSION = '1.0.0';
```

Correct:

```ts
// src/platform/retry.ts: a function and the type of its signature
export interface RetryOptions {
  readonly attempts: number;
}

export function retry(options: RetryOptions): Aspect {}

// src/platform/rabbit-mq-event-bus.ts
export class RabbitMqEventBus {}

// src/platform/index.ts
export { retry, type RetryOptions } from '@/platform/retry';
```

## Details

**What is counted.** The distinct names of the exported classes (abstract or not), interfaces and functions. An exported `const`, `type` or `enum` is never counted, the overloads of a function count once, and a function sharing its name with an interface or a type (`CommandHandler` the decorator and `CommandHandler<M>` the shape it decorates) counts once. A file with no counted export is not judged at all, neither for its count nor for its name.

**What may stand together.** Two or more counted exports pass when one of these holds:

| Allowance | Rule |
|---|---|
| the types of the signature | every other counted export is an interface reached from the signature of one export of the file: the parameters and the return type of a function (every overload), the constructor, the public members and the `implements` list of a class, the members of an interface or of a type alias, and from there through the interfaces and type aliases of the file. `type Result = Ok \| Err` with its two interfaces is this case |
| a derived form | a function named after the main function with a suffix and called by it (`retryAdvice` next to `retry`) stands with it, with the types of its own signature |
| a type and its constructors or combinators | every exported function returns one type, declared by the file or imported by it (`allOf`, `anyOf`, `not` returning `Condition`); when that type is a union of the file, a function may return one of its members |
| the accessors of one private state | every exported function reads or writes a module-level variable that is not exported (a `let`, or a `const` holding a `new ..`), and those variables tie the functions into one group (`sequence` and `resetSequences` around `const counters = new Map()`) |

Anything else is declared, with the sentence that says why the exports are one thing, in `onePerFile.allow` of `ddd-ts-kit.config.json` or in the option `allow`.

**The file name.** The base name without its extension, with every `.` read as `-`, is the kebab-case of the export: `rabbit-mq-event-bus.ts` for `RabbitMqEventBus`, `standard-schema-v1.ts` for `StandardSchemaV1`, `http-server.ts` for `HTTPServer`, `issue-invoice.handler.ts` for `IssueInvoiceHandler`. In a role file `<name>.<role>.ts` whose export does not end with the role word, the part before the first dot is the name: `invoice.aggregate.ts` for `Invoice`, `payment-gateway.port.ts` for `PaymentGateway`. A product is spelled in the file name as the class spells it.

The export the file is named after is the counted one; with the types of a signature, any export that holds the others in its signature (`job-run-observer.ts` for a `type JobRunObserver` that takes the exported `interface JobRunDetail`); with a type and its constructors, the type when the file declares it. A family that no export names (the accessors of a state, the combinators of an imported type) is named freely. A file allowed by `allow` is named after one of its exports.

**Entry files** may hold `export .. from`, `export * from`, `export type .. from` an import for its side effect (`import 'reflect-metadata';`) and the empty `export {};` of a package that exports nothing yet, nothing else. They are exempt from the count and from the name.

## Options

| Option | Default | Meaning |
|---|---|---|
| `allow` | `[]` | `[{ "file": "<path or glob>", "reason": "<why these exports are one thing>" }]`, added to `onePerFile.allow` of the config; an allowed file is exempt from the count, never from its name |
| `entries` | `[]` | globs of the entry files besides every `index.ts` and `<contextsDir>/*/*.declarations.ts`: the subpath entries of a package (`packages/*/src/testing.ts`) |

Paths and globs are posix, relative to the project root (the directory of `ddd-ts-kit.config.json`, else the working directory): `**` crosses directories, `*` stays inside one, `?` is one character. An entry of `allow` without a `file` or without a `reason` allows nothing.

`rules."clean/one-export-per-file"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/one-export-per-file -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The signature is read from the syntax, without types: a type reached only through an inferred return type or through a type of another file is not seen as a companion. Write the return type.
- Only interfaces are companions: a second class or a second function is never excused by a signature.
- A re-export (`export { a } from`) in a file that also declares something is not counted and not reported.

## With the CLI checker

`ddd-ts-kit check` holds the same count, the same `allow` list, the entry file rule and the file name, with a text approximation of the allowances. This rule is the authority.
