# Local infrastructure. `npm run infra:up` starts it and waits until it is healthy;
# add `--profile observability` to also get Jaeger. Ports come from .env (see .env.example).
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
  jaeger:
    image: jaegertracing/jaeger:2.22.0
    profiles: [observability]
    ports:
      - "${JAEGER_UI_PORT:-16686}:16686"
      - "${OTLP_HTTP_PORT:-4318}:4318"
{{#if database.server}}

volumes:
{{/if}}
{{#if database.postgres}}
  postgres-data:
{{/if}}
{{#if database.mysql}}
  mysql-data:
{{/if}}
