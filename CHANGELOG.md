# Changelog

What each version changes for someone who uses the kit. The packages of `packages/` are released
together, under one version; the notes of each [GitHub release](https://github.com/gbourgeat/ddd-ts-kit/releases)
list the pull requests behind it.

## 0.2.0

**A class states its dependencies once, in its constructor.** In the declared style a
decorator no longer repeats what the constructor takes:

```ts
@CommandHandler(RegisterPersonCommand)
export class RegisterPersonHandler implements CommandHandler<RegisterPersonCommand> {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly clock: Clock,
  ) {}
}
```

- The constructor signature is the single statement of what a declared class depends on, for
  every declaring decorator: `@CommandHandler`, `@QueryHandler`, `@DomainEventHandler`,
  `@IntegrationEventHandler`, `@Scheduled`, `@Projection`, `@Repository`, `@Gateway`,
  `@Adapter`, `@Policy`. Each parameter is typed by one class, which is its injection token.
- No compiler metadata. `emitDecoratorMetadata` exists only with legacy decorators compiled by
  `tsc` or swc: it is absent with standard decorators and under `tsx` and esbuild, and it is
  `Object` for a port imported with `import type`. `ddd-ts-kit docs`, every `generate` and
  every start of `npm run dev` read the signatures from the sources and write
  `injected(Class, [Tokens])` statements in the generated file of each context:
  `<context>.declarations.ts`, after its exports, or `<context>.dependencies.ts` under
  discovery, which `discoverContext` loads with the role files. `@ddd-ts-kit/di` injects from
  there, in both decorator modes, whoever compiles. `injected` and `injectedDependencies` are
  new exports of `@ddd-ts-kit/kernel/declarations`, `declaredTokens` of `@ddd-ts-kit/di`.
- Three guards against a stale generated list. `declarations/barrel-current` and
  `ddd-ts-kit docs --check` fail when a constructor changed without regeneration, and now name
  the class. The `dev` script loads `ddd-ts-kit/dist/refresh-declarations.js` before the
  application, on every start and reload: a port added to a constructor is injected on the
  reload that follows the save. And `createApplication` refuses, by name, a class that takes
  parameters and has no list, or a list of another length: new `WiringError` codes
  `MISSING_DEPENDENCIES` and `DEPENDENCY_ARITY`. Nothing is injected as `undefined`.
- New rule `declarations/constructor-injection`, in `ddd-ts-kit check` and in the ESLint
  plugin: a constructor parameter of a declared class names exactly one class. An interface, a
  type alias, a union, a primitive, an optional or defaulted parameter, a rest parameter and a
  constructor inherited from a class of a package are refused, each with its fix; a value is
  carried, as before, by an abstract class bound in the platform.
  `ports/no-concrete-dependency` now also holds the types of constructor parameters.
- **A 0.1 project keeps working untouched.** A list written in a decorator,
  `@CommandHandler(Message, [Ports])`, is still read, still checked by the compiler and wins
  over the signature. New config key `stack.dependencies`: `signature`, which `init` writes
  (`init --dependencies listed` for the other), or `listed`, which is what a config without the
  key means and under which lists are never reported. To migrate: set
  `"dependencies": "signature"`, run `npx eslint . --fix` (the rule removes every list that
  repeats its constructor and reports the ones that differ), run `npx ddd-ts-kit docs`, and add
  `--import ddd-ts-kit/dist/refresh-declarations.js` to the `dev` script. Under discovery, add
  `src/contexts/*/*.dependencies.ts` to the entries of knip (inside the pattern of the role
  files, as `init` writes it) and to the orphan exceptions of dependency-cruiser (`ddd-ts-kit depcruise-config --write` does the second).
- In the types, the dependency list of every decorator is optional, and a decorator without a
  list accepts any constructor: the compiler no longer reports, at the decorator, a list that
  was forgotten. The list is derived instead, and the generated `injected(...)` is checked
  against the constructor as a written list was. A declaration read with `declarationOf`
  carries `dependencies: undefined` when its decorator lists nothing, where it carried `[]`.
- The explicit style stays explicit: `.toClass(Adapter, [Ports])` and
  `.handledBy(Handler, [Ports])` list what a class is given. NestJS and manual wiring are not
  concerned.
- A test assembles a context from its generated file, as the composition root does; to build
  one class alone, take it from that file
  (`contextModule('billing', { IssueInvoiceHandler: billing.IssueInvoiceHandler })`).

**Projections are a role of the CLI.** `application/projections/*.projection.ts` joins the
canonical tree (`tree/closed`, `naming/suffix`, `naming/one-concept-per-file`,
`test/spec-required`), the generated barrel exports a projector and registers what its
constructor takes, discovery, knip and dependency-cruiser know the suffix, and
`ddd-ts-kit describe` and the reference of `CONTEXT.md` list each projection with the events it
applies. New generator `ddd-ts-kit generate projection <context> <Name> <event-type>`
(declared style): a projector of an integration event of the context itself or of a declared
upstream, and its spec. A project that declared `application/projections` in
`extraDirectories` removes the entry and its deviation, runs `ddd-ts-kit docs` (its barrels
gain one line per projection) and gives each projection a spec, which `test/spec-required`
now asks for; a composition root or a test that
added projections to a context by name removes them, the barrel now brings them, and a handler
spec gives a fake to the read model a projection of its context writes.

**Imports without the `.js` extension, by default.** A new project imports its own files by
their alias and nothing else:

```ts
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
```

- `importExtension` in `ddd-ts-kit.config.json` says how an import ends: `none`, which `init`
  now writes, or `js`, the previous spelling (`init --import-extension js`). Everything `init`
  and `generate` write follows it: every template, the declarations barrels, the published
  language indexes, the wiring of the composition root.
- With `none`, the generated `tsconfig.json` resolves as a bundler does (`"module": "ESNext"`,
  `"moduleResolution": "Bundler"`, `"customConditions": ["node"]`); a file that does not exist
  is still a compile error. Node needs the extension at run time, so `ddd-ts-kit build-aliases`,
  the second step of `npm run build`, now writes the full relative path with `.js` whichever
  spelling the sources use, and the output runs under plain `node` as before.
- New rule `imports/extension`, in `ddd-ts-kit check` and in the ESLint plugin, with a fix: an
  import of a file of the project ends as the config says. Under `none` it also refuses an
  import that names a directory: write `.../published-language/index`.
- `imports/alias-declared` holds what derives from the key: the two resolution options of
  `tsconfig.json`, the pattern of the jest mapping, and the build step.

**Nothing breaks.** A config file without `importExtension`, which is every project generated by
0.1.x, is read as `js`: its imports, its `tsconfig.json`, its jest mapping and its build are
judged and rewritten exactly as before, and `init` run again keeps that spelling. To move such a
project: set the key to `none`, write the two compiler options `ddd-ts-kit check` then asks
for, run `eslint --fix` and the formatter ([docs/CONFIG.md](docs/CONFIG.md)).

One behaviour of `build-aliases` is stricter in both spellings: a specifier names one emitted
file, by the path the config's spelling gives. It used to fall back to `<specifier>.js` and to
`<specifier>/index.js`, which no generated project relied on, since the compiler refused both
under `NodeNext`. It now says what to write instead.

Also:

- **`init --force` keeps the config.** It used to write the config anew: the declared contexts,
  the rules, the limits and the deviations were dropped, and the composition root no longer
  assembled anything. It now changes in the config the stack choices its flags name and nothing
  else, and wires the declared contexts again into the files it rewrites.
- `init` run again on a pnpm project no longer adds every agent permission a second time to
  `.claude/settings.json`.
- The checker and the ESLint plugin read an import written without its extension as the same
  source file as with it, whatever dots its name holds (`invoice.aggregate`): the layer and
  context rules judge both spellings alike.

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
