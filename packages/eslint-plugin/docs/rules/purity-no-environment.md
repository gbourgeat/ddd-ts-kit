# ddd-ts-kit/purity-no-environment

Architecture id: `purity/no-environment`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

Configuration, logs, files and the network are the outside world. Reached directly they make a use case depend on the machine it runs on; behind a port they are a parameter.

## Reported

- `process.env`, `argv`, `cwd`, `exit`, `stdout`, `stderr`, `stdin`
- any member of `console`
- a call of the global `fetch`, `new XMLHttpRequest`, `new WebSocket`, `new EventSource`
- an import of `fs`, `http`, `https`, `http2`, `net`, `dgram`, `dns`, `tls`, `child_process`, `worker_threads`, `os`, `readline`, `axios`, `node-fetch`, `undici`, `got`, `dotenv`

Incorrect:

```ts
const url = process.env['PAYMENT_URL'];
console.log('charging', amount);
await fetch(url);
```

Correct:

```ts
await this.paymentGateway.charge(amount);
```

## Options

None.

`rules."purity/no-environment"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line purity/no-environment -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A wrapper around the forbidden access (a helper of the platform that calls `Date.now()`) is not seen here; the layer rules stop the import of that helper.
- A local declaration that shadows the global (`const process = ...`) is not reported.

## With the CLI checker

`ddd-ts-kit check` looks for the same names with regular expressions. This rule is the authority: it knows a shadowed name from the global, and code from a string.
