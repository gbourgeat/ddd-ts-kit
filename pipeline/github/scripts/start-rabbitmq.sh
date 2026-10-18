#!/bin/sh
# Starts the RabbitMQ broker the specs of @ddd-ts-kit/rabbitmq run against, and waits until it is
# fully booted: its port opens before it accepts a channel, and the first spec then met a broker
# still reconnecting. The image is pinned by digest and pulled with retries, like PostgreSQL.
set -eu

IMAGE="${RABBITMQ_IMAGE:-rabbitmq:4.3.6-alpine@sha256:6931816af1a943f471c038b278835d36692d55dec769232739296bb91b7de0f5}"
REGISTRIES="${RABBITMQ_REGISTRIES:-mirror.gcr.io/library public.ecr.aws/docker/library docker.io/library}"

pulled=""

for attempt in 1 2 3; do
  for registry in $REGISTRIES; do
    if docker pull --quiet "$registry/$IMAGE"; then
      pulled="$registry/$IMAGE"
      break 2
    fi

    echo "Pulling $registry/$IMAGE failed (attempt $attempt)."
  done

  sleep $((attempt * 5))
done

if [ -z "$pulled" ]; then
  echo "No registry served $IMAGE." >&2
  exit 1
fi

docker run --detach --name rabbitmq --publish 5672:5672 \
  --env RABBITMQ_DEFAULT_USER=kit --env RABBITMQ_DEFAULT_PASS=kit \
  "$pulled" > /dev/null

# The diagnostics run as the broker's user: run as root before the broker wrote its Erlang cookie,
# they write one the broker can no longer read, and it stops.
for second in $(seq 1 90); do
  if docker exec --user rabbitmq rabbitmq rabbitmq-diagnostics --quiet check_running > /dev/null 2>&1 &&
    docker exec --user rabbitmq rabbitmq rabbitmq-diagnostics --quiet check_port_connectivity > /dev/null 2>&1; then
    echo "RabbitMQ is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs rabbitmq >&2
echo "RabbitMQ did not become ready." >&2
exit 1
