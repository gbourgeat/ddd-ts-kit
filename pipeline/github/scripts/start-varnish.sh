#!/bin/sh
# Starts Varnish 9.1.0 on 127.0.0.1:<port>, in front of an application listening on this machine at
# <backend port>, with a VCL written by `ddd-ts-kit init --http-cache varnish` (its backend port rewritten).
#   sh pipeline/github/scripts/start-varnish.sh <vcl file> <backend port> <port> [container name]
# VARNISH_NETWORK=host runs it on the network of this machine instead, for a machine whose firewall keeps
# containers from reaching it: the backend is then 127.0.0.1.
set -eu

vcl="$1"
backend_port="$2"
port="$3"
name="${4:-ddd-ts-kit-varnish}"

backend_host="host.docker.internal"

if [ "${VARNISH_NETWORK:-bridge}" = "host" ]; then
  backend_host="127.0.0.1"
  docker create --name "$name" --network host --env "VARNISH_HTTP_PORT=$port" \
    --tmpfs /var/lib/varnish/varnishd:exec varnish:9.1.0 > /dev/null
else
  docker create --name "$name" --add-host host.docker.internal:host-gateway --publish "127.0.0.1:$port:80" \
    --tmpfs /var/lib/varnish/varnishd:exec varnish:9.1.0 > /dev/null
fi

# The VCL is copied into the container, so the rewritten file is removed at once.
rewritten="$(mktemp)"
sed -e "s/\.port = \"[0-9]*\";/.port = \"$backend_port\";/" -e "s/\.host = \"host\.docker\.internal\";/.host = \"$backend_host\";/" "$vcl" > "$rewritten"
chmod 0644 "$rewritten"
docker cp "$rewritten" "$name:/etc/varnish/default.vcl" > /dev/null
rm -f "$rewritten"
docker start "$name" > /dev/null

attempt=0
until [ "$(curl --silent --output /dev/null --write-out '%{http_code}' --request PURGE --header 'xkey-purge: nothing' "http://127.0.0.1:$port/")" = "200" ]; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    docker logs "$name"
    echo "Varnish did not answer on port $port." >&2
    exit 1
  fi
  sleep 1
done

echo "Varnish answers on http://127.0.0.1:$port, in front of port $backend_port of this machine."
