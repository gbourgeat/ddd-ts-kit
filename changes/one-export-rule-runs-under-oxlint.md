**`clean/one-export-per-file` runs under the JS plugin API of Oxlint.** The rule walked the
tree of a file through a node a parser may leave null (the body of a declaration without one),
which the parser of ESLint never does and the one of Oxlint does: under Oxlint the rule stopped
on 2,494 of the files of the kit with `Cannot convert undefined or null to object`. The walker
now walks nothing for what is not a node. The plugin as a whole runs under
`oxlint --type-aware` with `jsPlugins` set to `@ddd-ts-kit/eslint-plugin`, which stays a trial:
the API is alpha, and `no-redeclare` of Oxlint contradicts the compiler on a class and an
interface of one name.
