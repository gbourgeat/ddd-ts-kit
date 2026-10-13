import { ADR_DIRECTORY } from '../../check/governance/adr-directory.js';
import type { Workspace } from '../../workspace/index.js';

/** The number the next decision record of the project takes: one after the highest in `docs/adr/`. */
export function nextAdrNumber(ws: Workspace): string {
  const taken = ws.list(ADR_DIRECTORY).map((file) => Number(/^(\d+)-/.exec(file)?.[1] ?? '0'));

  return String(Math.max(0, ...taken) + 1).padStart(4, '0');
}
