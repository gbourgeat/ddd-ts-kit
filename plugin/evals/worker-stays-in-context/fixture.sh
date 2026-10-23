#!/usr/bin/env bash
# The scheduling example, then what this case plants. Runs with `--scaffold` only.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/scheduling-example.sh"
mkdir -p .ddd-ts-kit
printf '{"context":"notification","rows":["M1.40"],"branch":"worker/notification","trunk":"main"}\n' > .ddd-ts-kit/worker.json
