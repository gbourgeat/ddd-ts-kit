# Copy to .env: `npm run dev` and docker compose both read it. Never commit .env.
NODE_ENV=development
PORT=3000
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
{{#if authn.jwt}}

# Authentication: the issuer of the tokens, the audience this service answers to, the keys of the issuer.
AUTH_ISSUER=https://id.example.com/realms/app
AUTH_AUDIENCE={{project.name}}
AUTH_JWKS_URI=https://id.example.com/realms/app/protocol/openid-connect/certs
{{/if}}
{{#if authn.none}}

# Authentication is the development header (x-development-actor: <id>;roles=<a>,<b>): the application refuses to start with NODE_ENV=production.
{{/if}}

# Traces: start Jaeger with `docker compose --profile observability up -d`, then open http://localhost:16686
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME={{project.name}}
JAEGER_UI_PORT=16686
OTLP_HTTP_PORT=4318
