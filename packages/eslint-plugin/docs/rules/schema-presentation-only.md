# ddd-ts-kit/schema-presentation-only

Architecture id: `schema/presentation-only`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the production files of the shared kernel and of `domain/`, `application/`, `infrastructure/` and `published-language/` of a context, in a project whose config says `"stack.schemas": "shared"`.

## Why

A schema says what a client sends or receives: it is a presentation type, and it changes with the HTTP contract, not with the model. The shared kernel is imported by every layer of every context, so a schema written there reaches the domain and the use cases. A schema several contexts answer with lives under `presentation/` of the shared kernel, and only presentation layers import it.

## Reported

- in the shared kernel outside `presentation/`, an import of a validation library: zod, class-validator, class-transformer, class-validator-jsonschema, valibot, arktype, TypeBox, `@ddd-ts-kit/validation`
- in `domain/`, `application/`, `infrastructure/` and `published-language/` of a context, and in the shared kernel outside `presentation/`, an import of a file of `presentation/` of the shared kernel

Incorrect:

```ts
// shared-kernel/money.ts
import { IsInt, IsString } from 'class-validator';
export class Money { @IsInt() cents = 0; @IsString() currency = ''; }
```

Correct:

```ts
// shared-kernel/presentation/money.schema.ts, imported by presentation layers only
import { IsInt, IsString } from 'class-validator';
export class Money { @IsInt() cents = 0; @IsString() currency = ''; }
```

## Options

None.

`rules."schema/presentation-only"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line schema/presentation-only -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A validation library imported by `domain/` or `application/` of a context is reported by `layer/domain-purity` and `layer/application-inward`, not here. One imported by `infrastructure/` is allowed: an adapter may check what a remote system answers.
- Specs are not judged.

## With the CLI checker

`ddd-ts-kit check` holds the same rule on the text of the imports; `schema/no-duplicate-shape`, which compares the shapes of a context with each other and with the shared kernel, is held by the checker alone.
