#!/bin/sh
# Starts the OpenSearch node the specs of @ddd-ts-kit/opensearch run against and waits until it
# answers: one node, the security plugin disabled, half a gibibyte of heap, and no disk watermark,
# so that a runner with little free disk does not block the creation of indices. OpenSearch 3.9.0,
# pinned by digest and pulled with retries, from the next registry when one refuses.
set -eu

IMAGE="${OPENSEARCH_IMAGE:-opensearchproject/opensearch:3@sha256:3b55f6b6249cfdb92b52ee59adc8a266203ba9ef9f5d82544fad6f1af2f3609e}"
REGISTRIES="${OPENSEARCH_REGISTRIES:-docker.io mirror.gcr.io}"

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

docker run --detach --name opensearch --publish 9200:9200 \
  --env discovery.type=single-node \
  --env DISABLE_SECURITY_PLUGIN=true \
  --env DISABLE_INSTALL_DEMO_CONFIG=true \
  --env cluster.routing.allocation.disk.threshold_enabled=false \
  --env "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m" \
  "$pulled" > /dev/null

for second in $(seq 1 120); do
  if curl --silent --fail http://localhost:9200/_cluster/health > /dev/null; then
    echo "OpenSearch is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs opensearch >&2
echo "OpenSearch did not answer." >&2
exit 1
