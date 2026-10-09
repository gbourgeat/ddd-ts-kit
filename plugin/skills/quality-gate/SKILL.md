---
name: quality-gate
description: >-
  Runs the full quality gate of a ddd-ts-kit project (types, lint, tests, architecture
  rules, documentation and contract drift) and fixes what fails at the root cause. Use
  before committing or opening a pull or merge request, or when the user asks whether the
  work is clean, done or ready.
allowed-tools:
  - Bash(npm run verify)
  - Bash(npm run typecheck)
  - Bash(npm run lint *)
  - Bash(npm test *)
  - Bash(npm run docs:check)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit explain *)
---

# Quality gate

```bash
npm run typecheck
npm run lint
npm test
npx ddd-ts-kit check --format text
npm run docs:check
```

or `npm run verify`, which chains them. During work, `npx ddd-ts-kit check --changed-since origin/main`
is the fast loop.

## Reading a violation

Each one carries a rule id, a location and a `fix` sentence. `npx ddd-ts-kit explain <rule-id>`
gives the reason and a good and bad example. Fix the cause:

| Rule family | Usual root cause | Usual fix |
|---|---|---|
| `layer/*` | logic or a type sits in the wrong layer | move it, or introduce a port in `application/ports/` and an adapter |
| `context/*` | a context reaches into another's internals | publish a contract in the upstream's `published-language/`, or react to an integration event |
| `tree/*` | a new role appeared without a decision | use a canonical directory, or declare it in `extraDirectories` with the user's agreement |
| `naming/*` | file made by hand | regenerate with `ddd-ts-kit generate`, move the logic |
| `test/*` | behaviour without a test, or a mock | skill `ddd-ts-kit:testing`; do not lower the severity |
| `clean/*`, `purity/*`, `language/*` | unclear code, hidden dependency, name outside the glossary | skill `ddd-ts-kit:clean-code` |
| `composition/only-in-module` | an adapter instantiated in application code | inject the port, bind in `<context>.module.ts` |

## Not allowed without the user's explicit agreement

- `// ddd-ts-kit-disable-next-line`, and never without a reason after `--`.
- Changing a rule's severity in `ddd-ts-kit.config.json`.
- Adding a package to `domainAllowedPackages` or `applicationAllowedPackages`.
- `any`, `as` outside mappers, `!`, `@ts-ignore`, skipped or deleted tests to get to green.

Report the commands run and their real output. A failing gate is reported as failing.
