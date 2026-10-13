#!/bin/sh
# Starts the Dragonfly the Redis adapter specs run against (the background job store) and waits
# until it answers. Dragonfly rather than Redis: its scripts may only touch the keys they declare,
# so a store that passes here passes on Redis and Valkey too. Pinned by digest, pulled with
# retries, from the next registry when one refuses.
set -eu

IMAGE="${DRAGONFLY_IMAGE:-dragonflydb/dragonfly:v2.0.2@sha256:061f00b201b58e12f974e4e96c761a881ee1c05e9d8ee967466a604b7299753b}"
REGISTRIES="${DRAGONFLY_REGISTRIES:-docker.dragonflydb.io ghcr.io}"

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

docker run --detach --name dragonfly --publish 6379:6379 --ulimit memlock=-1 "$pulled" \
  --proactor_threads=2 --maxmemory=512mb > /dev/null

for second in $(seq 1 60); do
  if docker exec dragonfly redis-cli ping 2> /dev/null | grep -q PONG; then
    echo "Dragonfly is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs dragonfly >&2
echo "Dragonfly did not answer." >&2
exit 1
