#!/bin/sh
# Starts the NATS server, with JetStream, the specs of @ddd-ts-kit/nats run against, and waits
# until JetStream answers. The image is pinned by digest and pulled with retries, from the next
# registry when one refuses, like PostgreSQL.
set -eu

IMAGE="${NATS_IMAGE:-nats:2.15.0-alpine@sha256:ac8f88a6494bffc2c2a5289a0ca61cb28a9145c11ba5677cf24265d07f46d8d4}"
REGISTRIES="${NATS_REGISTRIES:-mirror.gcr.io/library public.ecr.aws/docker/library docker.io/library}"

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

# -m opens the monitoring port, whose health check says when JetStream is ready, not only the socket.
docker run --detach --name nats --publish 4222:4222 --publish 8222:8222 "$pulled" -js -m 8222 > /dev/null

for second in $(seq 1 60); do
  if curl --silent --fail "http://localhost:8222/healthz?js-enabled-only=true" > /dev/null; then
    echo "NATS is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs nats >&2
echo "NATS did not become ready." >&2
exit 1
