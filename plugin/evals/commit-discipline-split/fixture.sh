#!/usr/bin/env bash
# The scheduling example, then what this case plants. Runs with `--scaffold` only.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/scheduling-example.sh"
printf '// The notification is sent once per cause.\n' >> src/contexts/notification/application/commands/send-notification/send-notification.handler.ts
printf '// A slot is held once.\n' >> src/contexts/scheduling/application/commands/book-appointment/book-appointment.handler.ts
