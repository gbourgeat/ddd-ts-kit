#!/usr/bin/env bash
# The scheduling example, then what this case plants. Runs with `--scaffold` only.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/scheduling-example.sh"
python3 - <<'PLANT'
import re
p='src/contexts/notification/application/commands/send-notification/send-notification.handler.ts'
s=open(p).read()
s=s.replace("import { SendNotificationCommand }", "import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';\nimport { SendNotificationCommand }",1)
s=s.replace("  async execute(command: SendNotificationCommand): Promise<string> {", "  async execute(command: SendNotificationCommand): Promise<string> {\n    void Appointment;",1)
open(p,'w').write(s)
p='src/contexts/notification/domain/aggregates/reminder.aggregate.ts'
s=open(p).read()
s=s.rstrip('\n')+"\n\nexport function reminderPlantedAt(): Date {\n  return new Date();\n}\n"
open(p,'w').write(s)
PLANT
