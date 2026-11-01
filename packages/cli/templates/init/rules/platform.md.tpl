---
paths:
  - "{{config.platformDir}}/**"
  - "{{config.sourceRoot}}/main.ts"
  - "{{config.sourceRoot}}/apps/**"
{{#if style.explicit}}
  - "{{config.contextsDir}}/*/*.module.ts"
{{/if}}
---

# Platform and composition root

- One folder per concern, no file at the root: `composition/` turns the platform and the contexts into an application, `auth/` holds `authentication/` (who is calling), `authorization/` (what they may do, whatever the model) and the folder of the model, `observability/` the traces, logs, measures{{#if errors.sentry}} and error reports{{/if}}, `jobs/` the settings of the scheduled jobs{{#if audit.route}}, `audit/search-audit-entries/` the read side of the trail{{/if}}. A new file joins the folder of what it answers.
- `main.ts`, and each `apps/*/main.ts`, imports `platform/observability/tracing.ts` first{{#if errors.sentry}}, `platform/observability/errors.ts` second{{/if}}, then composes the application: nothing else belongs in an entry point.
- Contexts, routes and registries are added by the generator between `// ddd-ts-kit:` markers: never edit between them, never remove one.
{{#if di.container}}
- Ports and values are bound by class: `bind(Port).toClass(...)`, `toValue(...)`, or `rebind(Port)` over a default of the kernel module. No token helper, no injection constant; one exported class, interface or function per file.
- Cross-cutting behaviour lives here: spans through `kernelModule({ instrumentation })` (`composition/lay-foundations.ts`), `around: tracedRoutes()` at the HTTP boundary and `tracedPublisher` for the outbox relay; logs, measures, permissions and audit as bus middlewares (`buses/`); the policy of outbound adapters in `resilience/`.
{{/if}}
{{#unless di.container}}
- One `Platform` is built in `composition/create-platform.ts` and handed to each context; a port or a value is typed by an abstract class. No token helper, no injection constant; one exported class, interface or function per file.
- Cross-cutting behaviour lives here: spans through the members of `traceApplication()` (`composition/lay-foundations.ts`, handed to the buses and to every adapter by `composition/create-platform.ts`), `around: tracedRoutes()` at the HTTP boundary and `tracedPublisher` for the outbox relay; logs, measures, permissions and audit as bus middlewares (`buses/`); the policy of outbound adapters in `resilience/`.
{{/unless}}
{{#if files.any}}
- Files: `files/open-files.ts` opens the connector of `stack.storage` from `config/read-files.ts`{{#if di.container}}, `files/files.module.ts` binds the ports and the hourly purge of staged files, `files/staging-uploads.ts` stages the file a command carries on the command bus, before the transaction{{/if}}{{#unless di.container}}, `files/create-files.ts` builds them, `composition/compose-application.ts` registers the hourly purge of staged files and `buses/create-command-bus.ts` stages the file a command carries on the command bus, before the transaction{{/unless}}; the tools and the tests keep files in memory. A scanner of your own (an antivirus) is bound here, never called from a use case.
{{/if}}
{{#if search.opensearch}}
- Search: `search/open-search.ts` builds `SearchIndexes` from `config.search`, with the transport and the tenancy of the project{{#if tenancy.any}} (`attribute`: one index, a filtered alias per tenant; `index` there gives each tenant its own){{/if}}{{#if di.container}}, `search/search.module.ts` binds it{{/if}}{{#unless di.container}}, `platform.search` hands it to each context{{/unless}}, and the index of every store built from it is provisioned before its first request. No context opens a transport or sets a tenancy of its own. In production the security plugin stays on, with TLS and a user allowed on the indices and aliases of this project only.
{{/if}}
- `@ddd-ts-kit/tracing` and `@opentelemetry/*` are imported here and nowhere else (`tracing/platform-only`).
- Logs, spans and error reports carry identifiers and codes only: never arguments, payloads, error messages, nor anything personal beyond the id of the actor.
- Configuration is read here only, by `config/load-config.ts`: validated, fail fast, every problem named by its variable. A new variable joins `AppConfig` and `.env.example`. `RUN_JOBS` says whether a process runs the jobs, `jobs/job-settings.ts` what configuration changes of each.
- Stopping: the HTTP server, the relay, then `application.stop()`, which ends with the error reporter and, last, the logger; connections and tracing after it. Whatever logs closes before the logger.
{{#if style.explicit}}
- `<context>.module.ts` is the only place a context binds its adapters and registers its handlers (`composition/only-in-module`); the generator writes between its markers.
{{/if}}
- A change here is shared by every context: it goes in its own commit (`chore(platform): ...`), on the trunk, never inside a slice.
- Method: `/ddd-ts-kit:wiring` and `/ddd-ts-kit:cross-cutting`. A process for the jobs: `npx ddd-ts-kit generate worker`; a context alone: `npx ddd-ts-kit generate service <context>`.
