**A file of types only no longer fails the coverage floor of a Jest project on the `v8` provider.**
A file that declares interfaces and type aliases and is imported with `import type` only, for
example `application/commands/pay/pay.result.ts`, is never loaded at run time, and the `v8`
provider of Jest reported all its lines uncovered, so that the floor of the layer failed though
nothing executable was untested. `governedJestCoverage()` now reads each source file as text and
leaves out of `collectCoverageFrom` those that declare types only, as it does for the ports; a
layer that holds nothing else is held to nothing, under Vitest too. Vitest and the `babel`
provider of Jest already skipped such a file.

To move: nothing; a project that moved its types into the command file to get around it can move
them back.
