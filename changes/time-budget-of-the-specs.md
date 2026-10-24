**Each spec file is held to the time budget of its level.** The reporter of the test runner the kit
ships, `@ddd-ts-kit/testing/budget/vitest` and `@ddd-ts-kit/testing/budget/jest`, named in the runner
config `init` writes and passed with `--reporter` where the pipeline names its reporters, reads the
`budget` key of `ddd-ts-kit.config.json`, five seconds for a unit spec file and thirty for an
integration spec file by the reference, names the slowest spec of each level at the end of every run,
and warns when a spec file took more than its budget, its tests and hooks timed, the loading of its modules left out; `"enforce": true` under `budget` makes it fail the run, once the measures of a project are stable, since a duration depends on the load of the machine as much as on the spec. A unit
spec of a context runs the model and the use cases on fakes; an integration spec of a context, and a
spec of the platform, opens a database or reaches a server; the specs of the application outside the
contexts (end to end, acceptance, architecture) are not held. A slow spec hides a world rebuilt per
test, I/O behind a fake, or a wait: lowering a budget is free, raising one above the reference is a
recorded deviation (`"what": "budget.unit"`), and a budget that is no duration is reported by
`config/valid`. On the example, the slowest unit spec takes 1.6 seconds and the slowest integration
spec 11, under load.

To move: name the reporter in your runner config, `reporters: ['default', '@ddd-ts-kit/testing/budget/vitest']`
(or `budget/jest`), and in the commands of your pipeline that pass `--reporter`.
