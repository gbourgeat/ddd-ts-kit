**A project generated on Jest is green from its first minute, and the kit now runs it: Jest is
installed in the workspace and one Jest stack joins the stacks its end-to-end suite runs.** Running
it found what a type check could not: a Jest project listed `@vitest/coverage-v8`, which knip
refused as unused; knip entered its fakes and worlds through top-level patterns, reported as
matching nothing before the first context, instead of a `jest` section beside the `vitest` one of
a Vitest project; the extractability spec of `test/architecture/` gave `it.each` an empty table,
which Jest refuses, before the first context (it now waits with an `it.todo`); an import of a
directory (`@/contexts/<context>/published-language`) did not resolve, each alias now mapping to the
source then to the barrel of the directory; the modules of the Prisma client, written with `.js`,
did not resolve, now mapped back to their sources; and a hook opening the test database outlasted
the 5 seconds of Jest, now 60 as on Vitest. The identity preset is held green on NestJS,
class-validator, Prisma, shared tables and Jest, the stack of the spend management example.

To move: in `jest.config.js`, write each alias of `moduleNameMapper` as
`['<rootDir>/src/$1.ts', '<rootDir>/src/$1/index.ts']` (the check asks for it), add
`testTimeout: 60_000`, and on Prisma `'^(\\.{1,2}/.*)\\.js$': '$1'`; in `knip.json`, move the
entries of the fakes and the worlds into a `jest` section with `"config": ["jest.config.js",
"jest.e2e.config.js", "jest.mutation.config.js"]`; drop `@vitest/coverage-v8` from the dev
dependencies.
