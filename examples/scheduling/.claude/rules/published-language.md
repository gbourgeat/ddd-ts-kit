---
paths:
  - "src/contexts/*/published-language/**"
---

# Published language

- The only folder another context may import (`context/published-language-only`), and only once the relationship is declared in `ddd-ts-kit.config.json` (`context/declared-relationship`): declare first, import after.
- Imports only `@ddd-ts-kit/kernel`, `@ddd-ts-kit/events`, the schema library and other published languages (`context/published-language-is-a-contract`).
- One `defineIntegrationEvent({ type, version, payload })` per event and version, in `<aggregate>-<fact>.v<n>.integration-event.ts`, its payload next to it (`events/defined-in-published-language`). `index.ts` only re-exports.
- A payload holds identifiers and facts as primitives: never an aggregate, never what other contexts must not depend on.
- Additive inside a version: a field is added, never renamed or removed. Anything else is a new version (`--version <n+1>`), published next to the previous one until every consumer moved.
- The read contract of a gateway (`*.contract.ts`) lives here too: what a downstream may ask synchronously, as plain data.
- A change here is a contract change: committed on its own, before the consumers build on it, with the regenerated event catalog and AsyncAPI document (`npm run docs:generate`).
- Method: `/ddd-ts-kit:integration-event`. Create with `npx ddd-ts-kit generate integration-event <context> <Aggregate> <Fact> [--version <n>] --json`, or `generate gateway <context> <upstream> <Name>`.
