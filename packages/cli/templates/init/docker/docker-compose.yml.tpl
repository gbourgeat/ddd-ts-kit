# Local infrastructure. `npm run infra:up` starts it and waits until it is healthy;
# add `--profile observability` to also get Jaeger{{#if authn.keycloak}}, `--profile identity` to get Keycloak{{/if}}{{#if errors.sentry}}, `--profile errors` to get GlitchTip{{/if}}. Ports come from .env (see .env.example).
name: {{project.name}}

services:
{{#if database.postgres}}
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-app}
      POSTGRES_DB: ${POSTGRES_DB:-app}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 2s
      timeout: 3s
      retries: 30

{{/if}}
{{#if database.mysql}}
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_USER: ${MYSQL_USER:-app}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-app}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-app}
      MYSQL_RANDOM_ROOT_PASSWORD: "yes"
    ports:
      - "${MYSQL_PORT:-3306}:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -u $${MYSQL_USER} -p$${MYSQL_PASSWORD}"]
      interval: 2s
      timeout: 3s
      retries: 30

{{/if}}
{{#if broker.rabbitmq}}
  rabbitmq:
    image: rabbitmq:4-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-app}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-app}
    ports:
      - "${RABBITMQ_PORT:-5672}:5672"
      - "${RABBITMQ_MANAGEMENT_PORT:-15672}:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "check_port_connectivity"]
      interval: 5s
      timeout: 5s
      retries: 30

{{/if}}
{{#if broker.kafka}}
  # One node in KRaft mode, for local use: no ZooKeeper, one replica of everything.
  kafka:
    image: apache/kafka:4.3.1
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:${KAFKA_PORT:-9092}
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
    ports:
      - "${KAFKA_PORT:-9092}:9092"
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 > /dev/null 2>&1"]
      interval: 5s
      timeout: 10s
      retries: 30

{{/if}}
{{#if broker.nats}}
  # JetStream on, its streams kept on a volume; the monitoring port answers the healthcheck.
  nats:
    image: nats:2.15.0-alpine
    command: ["-js", "-sd", "/data", "-m", "8222"]
    ports:
      - "${NATS_PORT:-4222}:4222"
    volumes:
      - nats-data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8222/healthz"]
      interval: 2s
      timeout: 3s
      retries: 30

{{/if}}
{{#if redis.server}}
  # Any Redis protocol server fits behind REDIS_URL (Redis, Valkey, Dragonfly): the adapters use their common subset.
{{#if redis.streams}}
  # One server for all of it: the streams of the event bus live next to whatever else the platform keeps there.
{{/if}}
  {{redis.service}}:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
    ulimits:
      memlock: -1
    command: ["--maxmemory=512mb", "--proactor_threads=2"]
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - {{redis.service}}-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 30

{{/if}}
{{#if httpCache.varnish}}
  # Varnish in front of the API (`npm run dev` on the port of .env), with the VCL of docker/varnish: it keeps the public
  # answers, files them under the tags of their xkey header and lets the API purge them. Read the API through it at VARNISH_PORT.
  varnish:
    image: varnish:9.1.0
    ulimits:
      memlock: -1
    tmpfs:
      - /var/lib/varnish/varnishd:exec
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "127.0.0.1:${VARNISH_PORT:-6081}:80"
    environment:
      # The purges of the API reach it through the published port, from another address: they send this key.
      VARNISH_PURGE_KEY: ${VARNISH_PURGE_KEY:-}
    volumes:
      - ./docker/varnish/default.vcl:/etc/varnish/default.vcl:ro

{{/if}}
{{#if authn.keycloak}}
  # Keycloak {{keycloak.version}} in development mode, for local use only: it imports docker/keycloak/{{project.name}}-realm.json
  # at its first start (the API client, its audience mapper, a public client for the direct grant, demo users).
  keycloak:
    image: quay.io/keycloak/keycloak:{{keycloak.version}}
    profiles: [identity]
    command: ["start-dev", "--import-realm"]
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: ${KEYCLOAK_ADMIN:-admin}
      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD:-admin}
      KC_HEALTH_ENABLED: "true"
    ports:
      - "${KEYCLOAK_PORT:-8080}:8080"
    volumes:
      - ./docker/keycloak:/opt/keycloak/data/import:ro
    healthcheck:
      # The image has no HTTP client: the management port is asked through bash.
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && grep -q '\"UP\"' <&3"]
      interval: 5s
      timeout: 5s
      retries: 40

{{/if}}
  jaeger:
    image: jaegertracing/jaeger:2.22.0
    profiles: [observability]
    ports:
      - "127.0.0.1:${JAEGER_UI_PORT:-16686}:16686"
      - "127.0.0.1:${OTLP_HTTP_PORT:-4318}:4318"
{{#if errors.sentry}}

  # GlitchTip 6 in development mode, for local use only: an error tracker that speaks the Sentry protocol.
  # Its first start migrates its database, then creates a user (test@example.com / admin_pass), an organization
  # and a project, and prints the DSN to put in SENTRY_DSN: `docker compose logs glitchtip | grep 'DSN:'`.
  glitchtip:
    image: glitchtip/glitchtip:6.2.6
    profiles: [errors]
    depends_on:
      glitchtip-postgres:
        condition: service_healthy
      glitchtip-valkey:
        condition: service_started
    ports:
      - "127.0.0.1:${GLITCHTIP_PORT:-8000}:8000"
    environment:
      # Web and worker in one process.
      SERVER_ROLE: all_in_one
      DATABASE_URL: postgres://postgres:postgres@glitchtip-postgres:5432/glitchtip
      VALKEY_URL: redis://glitchtip-valkey:6379
      # Never in production: openssl rand -hex 32.
      SECRET_KEY: local-development-only-not-a-secret
      GLITCHTIP_DOMAIN: http://localhost:${GLITCHTIP_PORT:-8000}
      EMAIL_URL: consolemail://
      DEFAULT_FROM_EMAIL: glitchtip@localhost
      # Development only: required by the bootstrap below.
      DEBUG: "true"
      GLITCHTIP_BOOTSTRAP_DEV: "true"
    healthcheck:
      test: ["CMD", "python", "healthcheck.py"]
      interval: 10s
      timeout: 6s
      retries: 6
      start_period: 180s

  glitchtip-postgres:
    image: postgres:18-alpine
    profiles: [errors]
    environment:
      POSTGRES_DB: glitchtip
      POSTGRES_PASSWORD: postgres
    volumes:
      - glitchtip-postgres:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d glitchtip"]
      interval: 5s
      retries: 12

  glitchtip-valkey:
    image: valkey/valkey:9-alpine
    profiles: [errors]
{{/if}}
{{#if worker.on}}

  # The scheduled jobs in a process of their own: the same image, another entry point. The API then starts with its jobs off (RUN_JOBS).
  worker:
    build:
      context: .
      args:
        ENTRY: dist/{{config.sourceRoot}}/apps/worker/main.js
    profiles: [services]
    env_file: .env
    environment:
      RUN_JOBS: "true"
{{/if}}
{{#if compose.volumes}}

volumes:
{{/if}}
{{#if database.postgres}}
  postgres-data:
{{/if}}
{{#if database.mysql}}
  mysql-data:
{{/if}}
{{#if broker.nats}}
  nats-data:
{{/if}}
{{#if redis.server}}
  {{redis.service}}-data:
{{/if}}
{{#if errors.sentry}}
  glitchtip-postgres:
{{/if}}
