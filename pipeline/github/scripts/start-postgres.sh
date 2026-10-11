#!/bin/sh
# Starts the PostgreSQL the specs run against and waits until it accepts connections.
# A `services:` container is pulled once, before the job, and one refusal of a registry fails
# the run (a public mirror answered "toomanyrequests" once): here the image is pulled with
# retries, from the next registry when one refuses.
set -eu

IMAGE="${POSTGRES_IMAGE:-postgres:18}"
REGISTRIES="${POSTGRES_REGISTRIES:-mirror.gcr.io/library public.ecr.aws/docker/library docker.io/library}"

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

docker run --detach --name postgres --publish 5432:5432 \
  --env POSTGRES_USER=app --env POSTGRES_PASSWORD=app --env POSTGRES_DB=app \
  --health-cmd "pg_isready -U app -d app" --health-interval 2s --health-timeout 3s --health-retries 30 \
  "$pulled" > /dev/null

for second in $(seq 1 60); do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' postgres)" = "healthy" ]; then
    echo "PostgreSQL is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs postgres >&2
echo "PostgreSQL did not become healthy." >&2
exit 1
