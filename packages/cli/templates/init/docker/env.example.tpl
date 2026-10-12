# Copy to .env: `npm run dev` and docker compose both read it. Never commit .env.
NODE_ENV=development
PORT=3000
# debug, info, warn or error.
LOG_LEVEL=info
{{#if logger.stdout}}
# json only: one JSON line per entry on the standard output (`init --logger pino` or `--logger winston` brings a pretty format).
# LOG_FORMAT=json
{{/if}}
{{#unless logger.stdout}}
# json (one line per entry, everywhere) or pretty (a developer's terminal, never in production).
# LOG_FORMAT=pretty
{{/unless}}
# true writes "[message removed]" for the message of every logged error that is not a DomainError: for logs that leave your hands.
# LOG_SCRUB_MESSAGES=false
# Around every adapter that leaves the process (kinds external and gateway): attempts, first delay, time limit of one attempt.
# OUTBOUND_RETRY_ATTEMPTS=3
# OUTBOUND_RETRY_BASE_DELAY_MS=100
# OUTBOUND_TIMEOUT_MS=2000
{{#if docs.any}}
# Interactive API documentation at /docs. On by default outside production.
# API_DOCS=true
{{/if}}
# Scheduled jobs. RUN_JOBS says whether this process runs them: {{#if worker.off}}true by default; `ddd-ts-kit generate worker` moves them to a process of their own{{/if}}{{#if worker.on}}false by default, the worker (apps/worker) runs them{{/if}}.
# One job is switched off in one environment with JOB_<CONTEXT>_<JOB>_ENABLED=false (see {{config.platformDir}}/job-settings.ts).
{{#if worker.off}}
# RUN_JOBS=true
{{/if}}
{{#if worker.on}}
# RUN_JOBS=false
{{/if}}
{{#if database.postgres}}

POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=app
POSTGRES_PORT=5432
{{/if}}
{{#if database.mysql}}

MYSQL_USER=app
MYSQL_PASSWORD=app
MYSQL_DATABASE=app
MYSQL_PORT=3306
{{/if}}
{{#if persistence.needsUrl}}
{{#if database.postgres}}
DATABASE_URL=postgres://app:app@localhost:5432/app
{{/if}}
{{#if database.mysql}}
DATABASE_URL=mysql://app:app@localhost:3306/app
{{/if}}
{{#if database.sqlite}}
DATABASE_URL=file:./data/app.sqlite
{{/if}}
{{/if}}
{{#if events.outbox}}
OUTBOX_RELAY_INTERVAL_MS=500
{{/if}}
{{#if broker.rabbitmq}}

RABBITMQ_USER=app
RABBITMQ_PASSWORD=app
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
AMQP_URL=amqp://app:app@localhost:5672
{{/if}}
{{#if broker.kafka}}

# Kafka: the bootstrap brokers, as host:port separated by commas.
KAFKA_PORT=9092
KAFKA_BROKERS=localhost:9092
{{/if}}
{{#if broker.nats}}

# NATS with JetStream.
NATS_PORT=4222
NATS_URL=nats://localhost:4222
{{/if}}
{{#if authn.jwt}}

# Authentication: the issuer of the tokens, the audience this service answers to, the keys of the issuer.
AUTH_ISSUER=https://id.example.com/realms/app
AUTH_AUDIENCE={{project.name}}
AUTH_JWKS_URI=https://id.example.com/realms/app/protocol/openid-connect/certs
{{/if}}
{{#if redis.server}}

# The Redis protocol server (Dragonfly in docker-compose.yml): {{redis.uses}}.
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
{{/if}}
{{#if cache.rateLimit}}
# Requests one caller address may send per window before the HTTP layer answers 429.
# RATE_LIMIT_MAX=120
# RATE_LIMIT_WINDOW_MS=60000
{{/if}}
{{#if authn.keycloak}}

# Authentication: the Keycloak realm tokens come from, and the audience this service answers to.
# `docker compose --profile identity up -d --wait` starts a local Keycloak with the realm of docker/keycloak.
# Its demo users (demo-admin / demo-admin, demo-user / demo-user) and its admin account are for local development ONLY.
KEYCLOAK_PORT=8080
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM={{project.name}}
KEYCLOAK_AUDIENCE={{project.name}}-api
# The client whose client roles join the realm roles of the actor (optional).
# KEYCLOAK_CLIENT_ID={{project.name}}-api
{{/if}}
{{#if authn.none}}

# Authentication is the development header (x-development-actor: <id>;roles=<a>,<b>): the application refuses to start with NODE_ENV=production.
{{/if}}
{{#if errors.sentry}}

# Unexpected failures go to a Sentry or a GlitchTip project (same protocol, only the DSN differs). Without SENTRY_DSN the
# application starts and reports nothing. A local GlitchTip: `docker compose --profile errors up -d --wait`, then
# `docker compose logs glitchtip | grep 'DSN:'` prints the DSN; open http://localhost:8000 (test@example.com / admin_pass, local development ONLY).
# SENTRY_DSN=http://<public-key>@localhost:8000/1
# The environment issues are filed under (NODE_ENV when left out) and the release they are attached to (none when left out).
# SENTRY_ENVIRONMENT=development
# SENTRY_RELEASE=
# true removes the message of every reported error that is not a DomainError: for a tracker hosted by a third party.
# SENTRY_SCRUB_MESSAGES=false
GLITCHTIP_PORT=8000
{{/if}}
{{#if files.local}}

# Files live in a directory, never in the database; the application answers their signed links under /files.
# FILES_DIRECTORY=.data/files
# FILES_PUBLIC_URL=http://localhost:3000/files
# Signs the links, 32 characters at least: required in production (openssl rand -hex 32), drawn at each start elsewhere.
# FILES_SIGNING_SECRET=
{{/if}}
{{#if files.s3}}

# Files live in a bucket of the S3 protocol (MinIO in docker-compose.yml), never in the database.
# For AWS leave S3_ENDPOINT out; OVHcloud, Scaleway and Cloudflare R2 give their own endpoint (S3_REGION=auto for R2).
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET={{project.name}}-files
# The root account of the local MinIO, for local development ONLY: in a deployment, an access key allowed on this bucket only.
S3_ACCESS_KEY_ID=minio-app
S3_SECRET_ACCESS_KEY=minio-app-secret
MINIO_PORT=9000
{{/if}}

# Traces: start Jaeger with `docker compose --profile observability up -d jaeger`, then open http://127.0.0.1:16686
# Without an endpoint no span leaves the process.
# OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
# Share of the traces kept, 0 to 1, decided where a trace starts; left out, every trace is kept.
# TRACE_SAMPLE_RATIO=1
# continue: a consumed event stays in the trace of the request that published it. link: each delivery starts its own trace, linked to it.
# TRACE_CONSUMERS=continue
OTEL_SERVICE_NAME={{project.name}}
JAEGER_UI_PORT=16686
OTLP_HTTP_PORT=4318
