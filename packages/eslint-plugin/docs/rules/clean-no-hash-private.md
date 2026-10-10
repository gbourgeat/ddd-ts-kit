# ddd-ts-kit/clean-no-hash-private

Architecture id: `clean/no-hash-private`. Default severity: `error` in `recommended`, `error` in `strict`. Fixable with `--fix`.

Applies to: every linted file.

## Why

There is one way to hide a member: the `private` keyword. It reads the same on a field, a method, an accessor and a constructor parameter, the compiler checks it, and the rules of this plugin and the CLI checker read it. `#name` is a second spelling of the same intention, with a different run-time behaviour that nothing in a domain model relies on.

## Reported

- a field, a method, an accessor or a static member declared `#name`

Incorrect:

```ts
class Invoice {
  #total = 0;

  add(amount: number): void {
    this.#total += amount;
  }
}
```

Correct:

```ts
class Invoice {
  private total = 0;

  add(amount: number): void {
    this.total += amount;
  }
}
```

## Details

**The fix.** `--fix` rewrites the declarations of `#name` (a getter and its setter together) and every use of it into `private name`, with `private` placed before `static`, `readonly`, `async`, `get` and `set`, after the decorators. It is applied only when it cannot change what the code means:

- the class has no other member, and no constructor parameter property, called `name`;
- no other class of the file declares the same `#name`;
- the file has no brand check `#name in value`;
- every use is `this.#name` or `<identifier>.#name` inside the class.

Otherwise the member is reported without a fix. Two different names in one class are rewritten in two passes of the same `--fix` run.

## Options

None.

`rules."clean/no-hash-private"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-hash-private -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- `private` is erased at compile time: code that relied on `#name` being unreachable at run time (a brand check, a hostile caller) has to be rewritten by hand, which is why those cases are not fixed.
- A subclass that declares a member with the name freed by the fix is then a compile error; rename one of the two.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the file. This rule is the authority, and the only one that fixes.
