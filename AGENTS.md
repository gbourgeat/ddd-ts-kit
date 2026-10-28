# AGENTS.md - ddd-ts-kit

A coding agent plugin for Claude Code, Codex and GitHub Copilot (`plugin/`: skills, agents, hooks;
marketplace manifests in `.claude-plugin/` and, for Codex, `.agents/plugins/`), a CLI
(`packages/cli`) and runtime packages (`packages/*`) for DDD and Clean Architecture in
TypeScript. Public repository.

- `docs/ARCHITECTURE.md` is normative: rule ids, canonical tree. Checker, templates and skills
  implement it and change together. A test of the CLI fails when its section 3 lists a rule id
  the checker does not know. `docs/README.md` indexes the rest of the documentation.
- Commands: `npm run build`, `npm test`, `npm run lint`, `npm run format` (Biome, width 120), `npm run check:self`, `npm run check:dashes`, `npm run test:plugin`.
- `tsc` is TypeScript 7 (native). Do not use the TypeScript compiler JS API.
- Optional peers (zod, class-validator, express, fastify, nest, OpenTelemetry SDK) are imported
  only from their subpath entry file.
- Relative imports carry no `.js` and no `/index` (`'../config'`, `moduleResolution: Bundler`); the build writes them in `dist` (`pipeline/monorepo/add-extensions.mjs`).
- English only, no em dash or en dash, no `any`, no non-null assertion.
- What a change does for a user goes in a file of its own under `changes/` (see `changes/README.md`), never in `CHANGELOG.md`, and a change under `plugin/` leaves `version` of `plugin/.claude-plugin/plugin.json` alone: the release writes both, the plugin under the version of the packages; `claude plugin validate . --strict`, `claude plugin validate plugin --strict` and `claude plugin validate plugin/skills --strict` must pass.
- The four ORM, the brokers and the loggers are families at parity: an option or a contract
  capability added to one member reaches the others, or `pipeline/monorepo/families.mjs` says
  why not (`npm run check:parity`). What `init` refuses and what sibling flags generate
  differently is declared, decided or not yet, in `packages/cli/test/support/support-matrix.ts`.
  Never add a line there to turn a check green: fill the gap, or stop and ask the maintainer
  (the hook of `.claude/settings.json` asks before any edit of the two registries).
- Details: `CONTRIBUTING.md`.
