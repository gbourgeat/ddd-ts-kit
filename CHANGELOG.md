# Changelog

What each version changes for someone who uses the kit. The packages of `packages/` are released
together, under one version; the notes of each [GitHub release](https://github.com/gbourgeat/ddd-ts-kit/releases)
list the pull requests behind it.

## 0.1.1

**A project is green from its first minute.** In 0.1.0, `npx ddd-ts-kit init`, the install and
`verify`, which is what `init` tells you to run, failed on a project nothing had been generated
in. Fixed in the generator, and held by an end-to-end spec that runs that exact sequence on both
package managers and on every proven stack, with no context, one, several, and a first use case:

- `init` writes the generated contracts as the scripts of the project write them for a project
  without a route or an integration event of its own (`openapi/openapi.json`,
  `docs/integration/asyncapi.json`, `docs/integration/event-catalog.md`): `docs:check` passes at
  once and the first commit holds the contract. A contract that is already there is left alone.
- The dead-code gate passes on an empty project. The helper `ownPolicy`
  (`platform/resilience/own-policy.ts`) is written with the first adapter that uses it
  (`generate adapter`) instead of by `init`, where nothing imported it on tsyringe; knip is told
  what it enters a context by with the first context, and reads the fakes as entries of the test
  runner, so that it has no remark about its own configuration either.
- A project without a context has a spec to run and passes its linter: the proof that the
  platform wires alone is written by `init` (`test/architecture/extractable.spec.ts`), which each
  context then joins, and the composition root imports `contextModule` or `discoverContext` with
  the first context instead of before it.
- The integration run of the pipeline passes while the project has no integration spec yet.
- Under `--assembly discovery`, a context that was just declared and has no role file yet is
  discovered as an empty context (`@ddd-ts-kit/di`): it used to stop the application, the specs
  and the documents with `DISCOVERY_FAILED`.

In a project created with 0.1.0, nothing has to change: these fixes are about what `init` writes.
`generate adapter` now counts as writing a shared file for the first adapter of a project wired on
tsyringe (`--local-only` refuses it once, naming the file).

Also since 0.1.0:

- **pnpm by default.** `init` writes a project for pnpm, pinned in `package.json` and provided by
  corepack, unless `--package-manager npm`: every script, pipeline, hook, the Dockerfile, the
  guidance and the agent permissions are said in the words of the manager chosen.
- **`ddd-ts-kit affected`.** A pull or merge request runs the unit specs, the integration specs
  and the lint of the contexts its change reaches through the context map; the generated
  pipelines call it, and the default branch and the nightly schedule run everything.
- The release is published through npm trusted publishing (OIDC), with provenance and without a
  stored token.

## 0.1.0

First publication to the npm registry: the CLI `ddd-ts-kit` and the 23 packages `@ddd-ts-kit/*`.
