# Local infrastructure. `npm run infra:up` starts it and waits until it is healthy;
# add `--profile observability` to also get Jaeger{{#if authn.keycloak}}, `--profile identity` to get Keycloak{{/if}}. Ports come from .env (see .env.example).
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
{{#if cache.redis}}
  # Any Redis protocol server fits behind REDIS_URL (Redis, Valkey, Dragonfly): the adapters use their common subset.
  cache:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
    ulimits:
      memlock: -1
    command: ["--maxmemory=512mb", "--proactor_threads=2"]
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - cache-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 30

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
      - "${JAEGER_UI_PORT:-16686}:16686"
      - "${OTLP_HTTP_PORT:-4318}:4318"
{{#if compose.volumes}}

volumes:
{{/if}}
{{#if database.postgres}}
  postgres-data:
{{/if}}
{{#if database.mysql}}
  mysql-data:
{{/if}}
{{#if cache.redis}}
  cache-data:
{{/if}}
