#!/usr/bin/env bash
# The scheduling example, then what this case plants. Runs with `--scaffold` only.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/scheduling-example.sh"
mkdir -p src/contexts/notification/domain/services
printf 'export class ReminderHelper {\n  due(): boolean {\n    return true;\n  }\n}\n' > src/contexts/notification/domain/services/reminder-helper.ts
