# ddd-ts-kit/clean-stepdown

Architecture id: `clean/stepdown`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

A file reads like a newspaper: the intention at the top, the details below. A reader who opens a class meets what it does before how, and never has to scroll up to find the helper a function just called.

## Reported

- a private, `#private` or protected method declared before a public method
- a public static method declared after a public instance method (static factories come first)
- a private method declared above its first caller
- a non-exported top-level function, or constant holding a function, declared above its first caller

Incorrect:

```ts
function price(line: Line): number {
  return line.unit * line.quantity;
}

export function total(lines: Line[]): number {
  return lines.map(price).reduce(add, 0);
}
```

Correct:

```ts
export function total(lines: Line[]): number {
  return lines.map(price).reduce(add, 0);
}

function price(line: Line): number {
  return line.unit * line.quantity;
}
```

## Details

Callers are found with the scope manager for functions, and through `this.x`, `this.#x` and `ClassName.x` for members. Recursion and mutual recursion have no right order and are not reported. A constant holding a function is left alone when it is used while the module loads, since moving it below that use would break at run time.

## Options

None.

`rules."clean/stepdown"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/stepdown -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A member called only through another receiver than `this` or the class name (`other.#helper()`) has no known caller and is not reported.
- Constructors, properties that do not hold a function, accessors without body and overload signatures are neutral.
- An exported function is never asked to move: the order between exported functions is the author's.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file and stays the fast edit-time guard. This rule is the authority.
