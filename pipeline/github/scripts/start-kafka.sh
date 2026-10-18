#!/bin/sh
# Starts the Kafka broker (KRaft, one node) the specs of @ddd-ts-kit/kafka run against, and waits
# until it answers a client. A Kafka client connects to the addresses the broker advertises, so
# the connection-loss specs need a second listener, RELAYED, that advertises 127.0.0.1:9095, where
# the specs listen and relay to the port behind it, 9094 (packages/kafka/README.md, "Testing").
# The image is pinned by digest and pulled with retries, like MinIO.
set -eu

IMAGE="${KAFKA_IMAGE:-apache/kafka:4.3.1@sha256:77e3df9054047a88b520d0cc46e16696d3b22022e1d580aeccd2632df6532837}"
REGISTRIES="${KAFKA_REGISTRIES:-docker.io mirror.gcr.io}"

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

docker run --detach --name kafka --publish 9092:9092 --publish 9094:9094 \
  --env KAFKA_NODE_ID=1 \
  --env KAFKA_PROCESS_ROLES=broker,controller \
  --env KAFKA_LISTENERS=PLAINTEXT://:9092,RELAYED://:9094,CONTROLLER://:9093 \
  --env KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://127.0.0.1:9092,RELAYED://127.0.0.1:9095 \
  --env KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,RELAYED:PLAINTEXT \
  --env KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  --env KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  --env KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT \
  --env KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  --env KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1 \
  --env KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1 \
  --env KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 \
  "$pulled" > /dev/null

for second in $(seq 1 90); do
  if docker exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 > /dev/null 2>&1; then
    echo "Kafka is ready ($pulled, ${second}s)."
    exit 0
  fi

  sleep 1
done

docker logs kafka >&2
echo "Kafka did not become ready." >&2
exit 1
