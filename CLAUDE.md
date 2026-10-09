# CLAUDE.md - ddd-ts-kit

A Claude Code plugin (`plugin/`: skills, agents, hooks; marketplace manifest in `.claude-plugin/`), a CLI
(`packages/cli`) and runtime packages (`packages/*`) for DDD and Clean Architecture in
TypeScript. Public repository.

- `docs/ARCHITECTURE.md` is normative: rule ids, canonical tree. Checker, templates and skills
  implement it and change together.
- Commands: `npm run build`, `npm test`, `npm run check:self`, `node --test plugin/hooks/guard.test.mjs`.
- `tsc` is TypeScript 7 (native). Do not use the TypeScript compiler JS API.
- Optional peers (zod, class-validator, express, fastify, nest, OpenTelemetry SDK) are imported
  only from their subpath entry file.
- English only, no em dash or en dash, no `any`, no non-null assertion.
- A change under `plugin/` bumps `plugin/.claude-plugin/plugin.json` `version`; `claude plugin validate . --strict` must pass.
- Details: `CONTRIBUTING.md`.
