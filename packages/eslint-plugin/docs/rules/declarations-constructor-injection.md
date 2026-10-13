**English** · [Français](declarations-constructor-injection.fr.md)

# ddd-ts-kit/declarations-constructor-injection

Architecture id: `declarations/constructor-injection`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every role file of a context in a declared-style project (`stack.style: "declared"` in `ddd-ts-kit.config.json`), tests excluded. Nothing is reported in an explicit-style project, where the module file lists what each class is given.

## Why

The constructor signature is the one statement of what a declared class depends on. `ddd-ts-kit docs` reads it and writes, in the generated file of the context, the list the composition root injects: nothing is repeated in the decorator, and nothing can disagree with the constructor. That only works when each parameter names exactly one injection token, and a token is a class: an interface, a type alias or a primitive is erased by the compiler; a union names two things; an optional or defaulted parameter says the container might give nothing, and it always gives a value.

The compiler is not asked for the types at run time. `emitDecoratorMetadata` exists only with legacy decorators compiled by `tsc` or by swc with its option: standard decorators have none, `tsx` and esbuild emit none, and a port imported with `import type` is recorded as `Object`.

## Reported

On the class of a role file that carries a declaration decorator other than `@Requires` and `@Public`, when the decorator lists no dependency:

- a constructor parameter that is optional, has a default value, is a rest parameter or is destructured
- a constructor parameter without a type, or typed by anything but one class name, type arguments aside (`Cache<Session>` names `Cache`): a union, an intersection, an array, a function, a literal, an object type, a qualified name
- a constructor parameter typed by a type of the language (`string`, `number`, `Date`, `Map`...) or by an interface, a type alias or an enum the file declares

Under `"stack.dependencies": "signature"`, when the decorator carries a list and the class writes its constructor (or extends nothing):

- a list that names what the constructor is typed by, in order: it is redundant, and the fix removes it
- a list that differs from the constructor: it wins at run time, so the signature lies; no fix

Incorrect:

```ts
@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository | undefined,
    private readonly retries = 3,
    private readonly currency: string,
  ) {}
}

// "stack.dependencies": "signature"
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}
}
```

Correct:

```ts
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { InvoiceSettings } from '@/contexts/billing/application/ports/invoice-settings.port';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly settings: InvoiceSettings, // an abstract class with readonly members, bound to a value in the platform
    private readonly clock: Clock,
  ) {}
}
```

## Details

A parameter decorator of another library and the modifiers `public`, `private`, `protected`, `readonly` and `override` are looked through. A class that writes no constructor and extends nothing takes nothing.

The fix of a redundant list removes the list and the comma before it: `@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])` becomes `@CommandHandler(IssueInvoiceCommand)`. It is the codemod that moves a project to `"stack.dependencies": "signature"`: set the key, run `eslint --fix`, then `ddd-ts-kit docs`, which registers in the generated file of each context what the constructors take. A port that now only types a parameter may be imported with `import type`, which `@typescript-eslint/consistent-type-imports` fixes in a project compiled without `emitDecoratorMetadata`.

A project whose config does not say, or says `"stack.dependencies": "listed"`, lists its dependencies in its decorators as 0.1 did: its lists are never reported, and a class of it that lists nothing is held to the same rules about its parameters.

## Options

None.

`rules."declarations/constructor-injection"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line declarations/constructor-injection -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- An interface, a type alias or an enum imported from another file is not known to be one here: `ddd-ts-kit check` reads the imported file of the project and reports it. A name imported from a package is trusted, and the compiler judges the generated file, which imports it as a value.
- A class that inherits its constructor is not judged here: `ddd-ts-kit check` follows the base class through the project and reports one it cannot read (a class of a package).
- That the generated file registers the list of the current constructor is `declarations/barrel-current` of `ddd-ts-kit check`: it is a fact of the project, not of one file.
- That a parameter is typed by a port and not by an adapter or a fake is `layer/application-inward` and `ports/no-concrete-dependency`.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, across files, and stays the fast edit-time guard. This rule is the authority on what one file shows, and the only one that fixes.
