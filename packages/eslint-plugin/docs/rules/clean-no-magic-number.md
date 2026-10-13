**English** · [Français](clean-no-magic-number.fr.md)

# ddd-ts-kit/clean-no-magic-number

Architecture id: `clean/no-magic-number`. Default severity: `error`.

Applies to: `domain/` and `application/` of every context of a project whose config says `"stack.literals": "named"`, which `init` writes (a config that does not say, as before 0.6, keeps the rule silent); tests excluded.

## Why

`hours * 60`, `limit = 100`, `padStart(2, '0')`: a number in the middle of the model says neither what it is nor who decided it. The second copy of it drifts from the first, and a rule of the business (a booking window, a reminder delay, a page limit) hides in an expression. Named once, it reads as the language: `MINUTES_PER_HOUR`, `LONGEST_ADDRESS`, `BookingWindow.standard()`.

## Reported

A number or bigint literal, the minus included, that is not:

- 0, 1 or -1 (configurable);
- an index, `items[2]`;
- a type, `type Hour = 7 | 8`, or the value of an enum member;
- in the initializer of a constant of the module (`const MINUTES_PER_HOUR = 60;`, an object or an array `as const` included) or of a `static readonly` field, with no function in between.

Incorrect:

```ts
function minuteOf(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
```

Correct:

```ts
const MINUTES_PER_HOUR = 60;

function minuteOf(hours: number, minutes: number): number {
  return hours * MINUTES_PER_HOUR + minutes;
}
```

## Details

A duration, an amount, a limit or a rate of the business is better a value object than a constant (`BookingWindow`, `Money`): the constant names the number, the value object also carries its rules.

## Options

`allow`: the numbers allowed anywhere, `[0, 1, -1]` by default.

```js
'ddd-ts-kit/clean-no-magic-number': ['error', { allow: [0, 1, -1, 2] }]
```

`rules."clean/no-magic-number"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-magic-number -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A constant of a function body, `const limit = 100` inside `execute`, is reported: it is named, but decided where it is used.
- Infrastructure, presentation and the platform are not judged: a port number or a page size of a route are configuration.

## With the CLI checker

None: the rule needs a syntax tree. `ddd-ts-kit check` knows its id so that the config can set its severity.
