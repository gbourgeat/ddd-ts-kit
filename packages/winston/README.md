**English** · [Français](README.fr.md)

# @ddd-ts-kit/winston

The kernel `Logger` port on [winston](https://github.com/winstonjs/winston): JSON lines on the
standard output, the correlation fields of the work in progress on every line, credentials
redacted, a flush for the shutdown. Nothing in `domain/` or `application/` imports this
package, or logs anything: the composition root binds the adapter, and infrastructure,
presentation and the aspects write through the port.

```
npm i @ddd-ts-kit/winston winston
```

Written against winston 3.19.

The domain and the handlers log nothing: what they have to say is an event or an error. The
adapters of `infrastructure/`, the controllers of `presentation/` and the aspects (`logged`,
`loggingMiddleware`, the job scheduler) receive the kernel `Logger`, and the composition root
binds `WinstonLogger` to it once. The code that logs is the same with `@ddd-ts-kit/pino` or
`StdoutLogger`: see [Logging from an adapter](../pino/README.md#logging-from-an-adapter).

## Composition root

<!-- checked sample -->
```ts
// platform/observability/create-logger.ts
import type { ExecutionScope, LogLevel } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';
import { createWinstonLogger, type WinstonLogger } from '@ddd-ts-kit/winston';

export interface LogSettings {
  readonly level: LogLevel; // LOG_LEVEL
  readonly format: 'json' | 'pretty'; // LOG_FORMAT
  readonly service: string;
  readonly environment: string;
  readonly scrubMessages: boolean; // LOG_SCRUB_MESSAGES
}

export function createLogger(scope: ExecutionScope, settings: LogSettings): WinstonLogger {
  return createWinstonLogger({ ...settings, fields: () => traceLogFields(scope) });
}
```

```ts
// main.ts
import { tracing } from '@/platform/tracing'; // first
import { createLogger } from '@/platform/observability/create-logger';
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';

const scope = new AsyncLocalStorageExecutionScope();
const logger = createLogger(scope, config.log);

const app = createApplication({
  modules: [kernelModule({ executionScope: scope, logger }), ...contexts],
});

process.once('SIGTERM', () => void shutdown());

async function shutdown(): Promise<void> {
  await app.stop(); // flushes the error reporter, then the logger, last: that ends the winston logger
  await tracing.shutdown();
}
```

`init --logger winston` writes this `create-logger.ts` (it answers a `NoopLogger` when given no
settings, which is how the tools and the tests stay silent); `platform/lay-foundations.ts`
calls it once and `composeApplication` hands the logger to `kernelModule({ logger })`.

One line of the application, as it is written:

```json
{"actorId":"user-1","context":"shipping","correlationId":"9f2c","environment":"production","level":"info","message":"order shipped","origin":"http","service":"shop-api","span_id":"00f067aa0ba902b7","tenantId":"acme","time":"2026-03-01T10:00:00.000Z","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736"}
```

![The path of one call to logger.info through winston: below the threshold the adapter stops after one comparison; otherwise it describes the errors among the fields and keeps level and message out of them; winston merges the fields of the line, the fields of the children and its defaultMeta; then the formats run in order: correlationFields fills the keys nobody gave from fields(), redactCredentials hides the credential keys, isoTime writes time, json or the pretty line serializes; each transport writes the line: the console by default, or the files, syslog or stream you give](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/winston-path-of-a-line.svg)

**Correlation.** `fields` is read at each line that is written, by a winston format: no call
site passes an id. `traceLogFields(scope)` answers the trace and span ids inside a span, and
inside the execution scope the correlation id, the causation id, the origin, the actor and the
tenant. This package does not depend on the tracing package: any `() => LogFields` fits,
`() => logFieldsOf(scope.current())` included. A function that throws gives no field, never a
lost line. The fields of the line win over those of a child, which win over `fields`: the
format only fills the keys nobody gave. `StdoutLogger` and `@ddd-ts-kit/pino` differ on the
second step (there `fields` win over a child), so do not bind in a child a key that `fields`
answers if the logger may be swapped.

![Which value a key gets when it is given twice, from the weakest to the strongest: with pino and StdoutLogger, service, environment and base, then the children, then fields(), then the line, which wins; with winston, fields(), then the children, then the line, then service, environment and base, which win](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/pino-which-value-wins.svg)

**An instance of your own.** The project that already configures winston keeps doing so, and
takes the formats it wants:

<!-- checked sample -->
```ts
import { CREDENTIAL_KEYS, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';
import winston from 'winston';
import { WinstonLogger, correlationFields, redactCredentials } from '@ddd-ts-kit/winston';

declare const scope: ExecutionScope; // the one the composition root creates

const instance = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    correlationFields(() => traceLogFields(scope)),
    redactCredentials([...CREDENTIAL_KEYS, 'iban']), // after the formats that add fields
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export const logger = new WinstonLogger(instance);
```

`createWinstonLogger` writes the instant under `time`, the level by its name and the message
under `message`, like the `StdoutLogger` of the aspects package and like `@ddd-ts-kit/pino`:
one dashboard reads the three. The keys of a line come out sorted: winston's JSON format
serializes with a stable stringifier.

**Transports of your own** without configuring winston yourself: `transports` replaces the
console, so name it too when the lines must still reach the standard output.

<!-- checked sample -->
```ts
import { createWinstonLogger } from '@ddd-ts-kit/winston';
import winston from 'winston';

export const logger = createWinstonLogger({
  service: 'shop-api',
  transports: [
    new winston.transports.Console(), // the standard output, as by default
    new winston.transports.File({ filename: 'logs/errors.log', level: 'error' }), // errors only, kept on disk
  ],
});
```

Each transport filters by its own `level` after the formats ran: the file above receives the
`error` lines, the console every line from the threshold of the logger.

## Development mode

```ts
createWinstonLogger({ level: 'debug', format: 'pretty', fields: () => traceLogFields(scope) });
```

```
10:00:00.000 info order shipped { context: 'shipping', service: 'shop-api', correlationId: '9f2c' }
```

The `pretty` format is made of winston's own combinators (`colorize`, `printf`), in the
process: no other package, the local time of day, the level in colour, the fields as Node
prints an object, a stack over several lines. Choose the format from configuration
(`LOG_FORMAT=pretty` in `.env`, `json` everywhere else).

## Privacy

Log lines are where personal data leaks: they are written everywhere, read by everyone and kept
for long. Three things are done in the adapter, so that no call site has to remember them.

**Credentials are redacted** by a winston format, in the fields of a line, of a child and of
`fields` alike. The value of these keys is replaced by `[redacted]`, at the top of a line and
one level below (`headers.authorization`, `body.password`):

`password`, `authorization`, `cookie`, `set-cookie`, `token`, `secret`, `apiKey`, `api_key`,
`access_token`, `refresh_token`, `accessToken`, `refreshToken`, `client_secret`

`redact: ['iban', 'ssn']` adds to the list. Names are matched exactly, case included, and
nothing is looked for deeper than one level: log the part you mean, not a whole request. The
objects you pass are never written to: a nested one is copied when a key has to be hidden.

**An error passed as a field** (`logger.error('payment failed', { error })`: the `LogValue` of
the port admits an `Error`) is written as `describeError` of the kernel describes it, the same
from every logger of the port: its class as `type`, its `code` when
it is a `DomainError`, its `message`, its own `stack`, then its `cause` the same way, up to
eight deep. Each error of a chain is written once. Errors are looked for among the fields of
the line, not inside nested objects. `CREDENTIAL_KEYS`, `REDACTED` and `SCRUBBED_MESSAGE` are
those of the kernel too.

**Messages of unexpected errors can be dropped.** The message of an error is the first place
where personal data shows up: a driver quotes the row it refused. The default keeps it, because
a log line that says `[message removed]` costs every investigation. With one option only the
messages the project wrote itself survive, those of its `DomainError`s; class, code, stack and
cause remain for the others, and the stack loses its first line, which repeats the message:

```ts
createWinstonLogger({ scrubMessages: true }); // or new WinstonLogger(instance, { scrubMessages: true })
```

This is the `scrubMessages` every logger of the port takes (`StdoutLogger`, pino, winston,
`InMemoryLogger`) and the one of `@ddd-ts-kit/sentry`, with the same rule, the same
`SCRUBBED_MESSAGE` and the same trade-off: turn it on when the logs leave your hands or when no
operator should read that data there. What the message of a log line itself says stays yours:
write `order shipped` and put the identifiers in fields.

The kit itself never hands an error to a logger: the `logged` aspect, `loggingMiddleware` and
the job scheduler write `errorType` and `errorCode` only (`identifyError` of the kernel), never
a message, whatever `scrubMessages` says, and the error goes to the `ErrorReporter`. The
description above is for the error your own code chooses to log:
`logger.error('payment failed', { error })`.

## Levels

| Port | winston (`npm` levels) | |
|---|---|---|
| `debug` | `debug` | below it, winston also has `silly` |
| `info` | `info` | the default threshold; `http` and `verbose` stand between `info` and `debug` |
| `warn` | `warn` | |
| `error` | `error` | |

The names are the same in the `cli` levels. An instance on the `syslog` levels has no `warn`:
say where it goes, or the line is dropped, since winston does not write at a level it does
not know.

<!-- checked sample -->
```ts
import { WinstonLogger } from '@ddd-ts-kit/winston';
import winston from 'winston';

const instance = winston.createLogger({
  levels: winston.config.syslog.levels, // emerg, alert, crit, error, warning, notice, info, debug
  transports: [new winston.transports.Console()],
});

export const logger = new WinstonLogger(instance, { levels: { warn: 'warning' } }); // logger.warn() writes at 'warning'
```

A line below the threshold costs one comparison: the adapter asks `isLevelEnabled` first,
because winston alone would run every format before its transports drop the line. The
threshold of an instance changed while running (`instance.level = 'debug'`) is followed by the
adapter and by its children. `isLevelEnabled(level)` of the port answers the same question for
the mapped level: ask it before building fields that cost. Once the logger was flushed it
answers `false` for every level.

`child(fields)` is a winston child: the fields are bound once, and winston merges them under
the fields of each line. Three things differ from what winston does when called directly, all
on purpose: a field named `level` or `message` never replaces the level or the message of the
line; the message is never read as a format string (`%s`); and with `createWinstonLogger` a
field named `time` is overwritten by the instant of the line. One thing is winston's:
`service`, `environment` and `base` are its `defaultMeta`, which wins over a field of the
same name on a line or in a child, where the other two loggers of the kit let the line and
the child win.

## Flush

`flush(): Promise<void>` ends the winston logger and resolves once each of its transports has
written what it was handed (their `finish` event). It never rejects, and a second call answers
the same promise. `app.stop()` calls it, last, after the modules stopped and the error reporter
was flushed: stopping logs too. Without the application of the di package, call it yourself at
that place.

| After `flush()` resolved | `@ddd-ts-kit/winston` | `@ddd-ts-kit/pino` |
|---|---|---|
| a line logged | dropped, without an error | written, like before |
| `isLevelEnabled(level)` | `false` for every level | the threshold, as before |
| a second `flush()` | the same promise | a new flush |

The port calls a flush once, at shutdown, and leaves what is logged afterwards unspecified.
Here the flush is final: a winston logger does not reopen, so what is logged afterwards,
through this logger or one of its children, is dropped without an error, and `isLevelEnabled`
answers `false`. Whatever must be logged about the shutdown is logged before `app.stop()`
returns. A transport over a stream you opened yourself
(a socket, a file stream given to the `Stream` transport) has handed its lines to that stream
when `flush()` resolves: ending that stream is yours.

## Performance

winston writes each line through a Node stream, a chain of formats and its transports, all in
the process and in the call: about 7 microseconds a line where `@ddd-ts-kit/pino` takes 3
(Node 24, a child, four correlation fields, three fields, a sink that discards), and more
with each format you add. Each line costs here one copy of its fields, one merge per level of
child, the format reading `fields`, the redaction pass over the top-level values, the instant,
and `JSON.stringify` through a safe serializer. That is nothing at a few hundred lines per
second and visible at tens of thousands: there, lower the level or take `@ddd-ts-kit/pino`.

Nothing is buffered by the adapter, so nothing is lost on a crash beyond what the transport
itself had not written. Log calls never throw: fields that cannot be read or serialized (a
getter that throws) give the line without them, marked `logError: "unserializable fields"`,
and `createWinstonLogger` holds its formats to the same rule inside the stream.

## Which one

Take `StdoutLogger` of the aspects package when JSON lines on the standard output are all you
need: no dependency, the same line shape. Take `@ddd-ts-kit/pino` when logging volume matters
or when the framework already speaks pino (Fastify). Take winston when the team already runs
its transports and formats (files with rotation, syslog, a vendor transport) and wants to keep
them. The three implement one port and are held by one contract suite: swapping is one line of
the composition root.

## NestJS

Nest has its own `LoggerService`, used by the framework for its own messages and by
`new Logger(context)` in Nest classes. Application code of the kit never needs it: handlers and
adapters receive the kernel `Logger`. To send what Nest itself logs through the same instance,
hand it a bridge of a few lines; the kit ships none, since it would bind this package to Nest:

```ts
const nest = logger.child({ context: 'nest' });
const bridge: LoggerService = {
  log: (message: unknown) => nest.info(String(message)),
  warn: (message: unknown) => nest.warn(String(message)),
  error: (message: unknown) => nest.error(String(message)),
  debug: (message: unknown) => nest.debug(String(message)),
};

const app = await NestFactory.create(AppModule, { logger: bridge });
```

`nest-winston` is the alternative when Nest classes log a lot: give it the winston instance
you built, and wrap the same instance in `new WinstonLogger(instance)` for the kit.

## In a test

Nothing of this package: the test application binds `InMemoryLogger` of the kernel, and its
`entries` are data. To hold another adapter of the port to the same behaviour, run the contract:

<!-- checked sample -->
```ts
import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
import { loggerContract, type LoggedLine } from '@ddd-ts-kit/testing/contracts';
import { createWinstonLogger } from '@ddd-ts-kit/winston';
import winston from 'winston';

loggerContract({ describe, it, expect, beforeEach }, {
  name: 'WinstonLogger',
  createLogger: (setup) => { // { level, fields, scrubMessages }
    const written: string[] = [];
    const stream = new Writable({
      write: (chunk, _encoding, done) => {
        written.push(String(chunk));
        done();
      },
    });
    const logger = createWinstonLogger({ ...setup, transports: [new winston.transports.Stream({ stream })] });

    return { logger, lines: () => written.map((line) => lineOf(JSON.parse(line))) };
  },
});

/** A written line as the contract reads it: the level by its name, the message, the other fields. */
function lineOf({ level, message, time: _time, ...fields }: Record<string, unknown>): LoggedLine {
  const known = LOG_LEVELS.find((one) => one === level);

  if (known === undefined) {
    throw new Error(`Not a level of the port: ${String(level)}`);
  }

  return { level: known, message: String(message), fields };
}
```
