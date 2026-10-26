**`generate service` writes a docker-compose.yml that Docker reads.** The compose service took `"${{service.portVariable}}:3000"` literally, because the templates keep every `${{ ... }}` for the expressions of a GitHub workflow, and `docker compose config` refused it. The port is now `"${PAGING_PORT:-3001}:3000"`: the service listens on the variable of its context, 3001 by default.

To move: a compose file written by an earlier `generate service` holds `${{service.portVariable}}`; replace it with `${<CONTEXT>_PORT:-3001}` (the context in upper snake case).
