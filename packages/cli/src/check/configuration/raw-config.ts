import { isRecord } from '../support/is-record.js';
import type { Project } from '../model/project.js';

/** The config as it is written, before parsing clamps a limit or drops an entry: what `config/valid` has to see. */
export function rawConfig(project: Project): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(project.configText);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
