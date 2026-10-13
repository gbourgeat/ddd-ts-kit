**English** · [Français](ports-value-import.fr.md)

# ddd-ts-kit/ports-value-import

Architecture id: `ports/value-import`. Default severity: `error` in `recommended`, `error` in `strict`. Fixable with `--fix`.

Applies to: every linted file.

## Why

The abstract class of a port is a value: it is what a container binds and resolves. `import type` erases it when the file is compiled, so a dependency list that names a type-only import has nothing to name at run time.

## Reported

- a name in a dependency list imported with `import type { X }` or `import { type X }`
- the first argument of `bind` or `rebind` imported that way

Incorrect:

```ts
import type { Clock } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoiceCommand, [Clock])
export class IssueInvoiceHandler {}
```

Correct:

```ts
import { Clock } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoiceCommand, [Clock])
export class IssueInvoiceHandler {}
```

## Details

A dependency list is the array that names what a constructor receives: the last argument of a declaration decorator of `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`, `@Repository`, `@Gateway`, `@Adapter`, `@Policy`) and the second argument of `.toClass(C, [..])` and `.handledBy(H, [..])` of `@ddd-ts-kit/di`.

A binding call is `bind`, `rebind`, `resolve`, `fake` or `override`, plain or as a member (`builder.bind(X)`, `app.resolve(X)`), and is read only in a file that imports something from `@ddd-ts-kit/di`; `Promise.resolve`, `path.resolve`, `require.resolve` and `import.meta.resolve` are never binding calls. Only `bind` and `rebind` are read by this rule.

**The fix.** `import { type X }` loses its keyword; `import type { X, Y }` becomes `import { X, type Y }`, which `@typescript-eslint/consistent-type-imports` then splits if the project asks for separate type imports.

## Options

None.

`rules."ports/value-import"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line ports/value-import -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The compiler reports the same mistake (a type used as a value) when the file is type-checked; this rule reports it at edit time and fixes it.
- A default or a namespace import is not rewritten by the fix when the declaration is `import type`.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the file. This rule is the authority, and the only one that fixes.
