#!/usr/bin/env bash
# Runs a heavy local command (the unit step of the pre-push hook, the ci:test:* scripts, a Stryker run) while
# holding one of two machine-wide slots, so that two agents or two worktrees never run more than two of them at
# once (6.8 to 7.3 GB each at its peak, docs/proposals/generated-project-families.md). A third waits for a slot.
#
#   bash pipeline/monorepo/heavy-lock.sh <command> [argument...]
#
# The slots are lock files in the runtime directory of the user ($XDG_RUNTIME_DIR, else the temporary directory);
# the number of slots is DDD_TS_KIT_HEAVY_SLOTS (2). In a pipeline ($CI), or where `flock` is missing, the command
# runs at once: a runner is its own machine.
set -u

if [ "$#" -eq 0 ]; then
  echo "usage: heavy-lock.sh <command> [argument...]" >&2
  exit 2
fi

if [ -n "${CI:-}" ] || ! command -v flock >/dev/null 2>&1; then
  exec "$@"
fi

directory="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}/ddd-ts-kit-$(id -u)}"
slots="${DDD_TS_KIT_HEAVY_SLOTS:-2}"
mkdir -p "$directory"
announced=0

while true; do
  for slot in $(seq 1 "$slots"); do
    exec {lock}>"$directory/ddd-ts-kit-heavy-$slot.lock"

    if flock --nonblock "$lock"; then
      # Not exec: the lock lives as long as this shell holds the descriptor.
      "$@"
      exit "$?"
    fi

    exec {lock}>&-
  done

  if [ "$announced" -eq 0 ]; then
    echo "heavy-lock: $slots heavy commands are running on this machine, waiting for a slot ($directory)." >&2
    announced=1
  fi

  sleep 5
done
