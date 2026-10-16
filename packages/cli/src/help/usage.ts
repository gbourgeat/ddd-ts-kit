/** Every command of the CLI and its flags, as `--help` prints them and docs/guides/commands.md shows them. */
export const USAGE = `Usage
  ddd-ts-kit init [--http express|fastify|hono|nest|none]
                  [--validation zod|class-validator|typebox|standard-schema|none]
                  [--di tsyringe|nest|manual] [--tests vitest|jest]
                  [--orm drizzle|knex|prisma|typeorm|custom|none] [--database postgres|mysql|sqlite|none]
                  [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                  [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                  [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                  [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis] [--http-cache none|varnish]
                  [--storage local|s3|none]
                  [--audit on|off]
                  [--errors none|sentry] [--logger stdout|pino|winston] [--style declared|explicit] [--assembly barrel|discovery]
                  [--dependencies signature|listed] [--refusals factories|classes]
                  [--routes controllers|functions] [--representations negotiated|json] [--forms on|off]
                  [--value-objects throwing|result] [--literals named|free] [--values classes|free] [--tenancy none|shared-table] [--queue database|redis|memory]
                  [--schemas shared|per-route]
                  [--package-manager npm|pnpm] [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                  [--import-extension none|js] [--sdk]
                  [--context <name>:<core|supporting|generic>]... [--preset identity]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit generate --help --json
  ddd-ts-kit list [--context <name>]
  ddd-ts-kit describe <context>
  ddd-ts-kit status [--workers]
  ddd-ts-kit doctor [--strict]
  ddd-ts-kit todo [<context>]
  ddd-ts-kit plan-waves [<context>]
  ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--dry-run]
  ddd-ts-kit verify-slice <context> --since <git-ref>
  ddd-ts-kit docs [--check] [--stored-events]
  ddd-ts-kit sdk [--check] [--dry-run]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit build-aliases [--project <tsconfig>]
  ddd-ts-kit drizzle-generate --name <what-it-does> [--custom]
  ddd-ts-kit error-factories --plan | --apply [--dry-run]
  ddd-ts-kit controllers [<context>] [--dry-run]
  ddd-ts-kit value-objects [--dry-run]
  ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check --commit-size [--staged] [--strict]
  ddd-ts-kit check-file <path>
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).`;
