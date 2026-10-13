#!/bin/sh
# Starts the MinIO server the specs of @ddd-ts-kit/s3 run against and waits until it is ready.
# The upstream project stopped publishing images in 2025; pgsty/minio builds the same server from
# its sources. The image is pinned by digest and pulled with retries, like PostgreSQL.
set -eu

IMAGE="${MINIO_IMAGE:-pgsty/minio:RELEASE.2026-08-04T00-00-00Z@sha256:b6bfe7239bfc83fb90d31612d9704d86039dd714f7904b3f1ad68f211e602372}"
REGISTRIES="${MINIO_REGISTRIES:-docker.io mirror.gcr.io}"

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

docker run --detach --name minio --publish 9000:9000 \
  --env MINIO_ROOT_USER=ddd-ts-kit --env MINIO_ROOT_PASSWORD=ddd-ts-kit-secret \
  "$pulled" server /data > /dev/null

for second in $(seq 1 60); do
  if curl --silent --fail http://localhost:9000/minio/health/ready > /dev/null; then
    echo "MinIO is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs minio >&2
echo "MinIO did not become ready." >&2
exit 1
