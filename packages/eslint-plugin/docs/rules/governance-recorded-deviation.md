**English** · [Français](governance-recorded-deviation.fr.md)

# ddd-ts-kit/governance-recorded-deviation

Architecture id: `governance/recorded-deviation`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

The architecture can be changed deliberately, not bypassed case by case. A suppression is either refused or recorded as a decision, with its reason, its scope and the condition for removing it. A shortcut that is not written down is a defect, whoever asked for it.

## Reported

- `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` and `ddd-ts-kit-disable-next-line` whose reason after `--` holds no `ADR-<digits>`
- the same comments when they name no rule at all, whatever follows `--`

Incorrect:

```ts
/* eslint-disable */
// eslint-disable-next-line no-console -- the CLI prints its result
console.log(result);
```

Correct:

```ts
// eslint-disable-next-line no-console -- ADR-0012: the CLI prints its result
console.log(result);
```

## Details

Record the decision with `ddd-ts-kit generate adr`, then reference its number.

ESLint drops a report made inside the range of a directive that covers its rule, so a blanket `/* eslint-disable */` would silence the very rule that judges it. Such a comment (blanket, or naming `ddd-ts-kit/governance-recorded-deviation` without a decision record) is therefore reported ahead of the range it opens: at the first position of the file for `eslint-disable`, on the line above for `eslint-disable-line`. The message always gives the line of the comment.

`clean/no-escape-hatch` reports an `eslint-disable` with no reason at all; this rule asks more of the reason. With both enabled, a comment without any reason is reported twice.

## Options

None.

`rules."governance/recorded-deviation"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line governance/recorded-deviation -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- That `docs/adr/` holds the record named is not checked here: `ddd-ts-kit check` does.
- The other deviations of the architecture reference (a lowered severity, an extra directory, an extra allowed package in `ddd-ts-kit.config.json`) are not sources: `ddd-ts-kit check` judges them.
- A suppression written in the ESLint config (`rules: { ...: 'off' }`, `ignores`) or on the command line is out of reach of any rule.
- The report placed ahead of a blanket disable relies on the order in which ESLint applies directives; `// eslint-disable-next-line ddd-ts-kit/governance-recorded-deviation` written on the line above a comment still silences its report.
- `@ts-expect-error` and `@ts-ignore` are held by `@typescript-eslint/ban-ts-comment`.

## With the CLI checker

`ddd-ts-kit check` reports the same id for the suppressions and for the config, and verifies that the decision record exists. This rule is the authority for the comments ESLint understands.
