**A guide says how a ddd-ts-kit project is deployed and rolled back.** `docs/guides/deploy-and-rollback.md`
names what a project ships beyond the image the pipeline builds (the migrations, the API with its
outbox relay, the worker, a context as a service, the readiness route written with `--cache redis`
only, the OpenTelemetry export), the order of a release (migrate forward compatibly, deploy, relay),
what a rollback of each piece means, the three tiers of autonomy of an agent mapped on the
environments with the production gate of the regulated profile, deploy, status and rollback as one
script each reached through an MCP server of the platform team or through the `allow` list and
never both, the rollback rehearsed in staging, and what the kit does not do: no deployment tool, no
MCP server. Indexed in `docs/README.md`.
