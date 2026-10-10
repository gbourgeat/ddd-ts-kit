# Copy to .env: `npm run dev` and docker compose both read it. Never commit .env.
NODE_ENV=development
PORT=3000
# debug, info, warn or error: one JSON line per entry on the standard output.
LOG_LEVEL=info
# Around every adapter that leaves the process (kinds external and gateway): attempts, first delay, time limit of one attempt.
# OUTBOUND_RETRY_ATTEMPTS=3
# OUTBOUND_RETRY_BASE_DELAY_MS=100
# OUTBOUND_TIMEOUT_MS=2000
{{#if docs.any}}
# Interactive API documentation at /docs. On by default outside production.
# API_DOCS=true
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

# Traces: start Jaeger with `docker compose --profile observability up -d`, then open http://localhost:16686
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME={{project.name}}
JAEGER_UI_PORT=16686
OTLP_HTTP_PORT=4318
