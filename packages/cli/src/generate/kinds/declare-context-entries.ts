import type { Config } from '../../config';
import { DISCOVERED_SUFFIXES, EDGE_SUFFIXES } from '../../declared';
import type { Workspace } from '../../workspace';
import { isDeclared } from '../is-declared';
import { editJson } from './extraction/edit-json';
import { knipProject } from './knip-project';

const KNIP_FILE = 'knip.json';
const PUBLISHED_LANGUAGE = 'published-language/index';

/**
 * What knip enters a context by, told to it with the first context: before one exists the
 * patterns match nothing, which knip reports. A module file where the wiring is written; under
 * discovery the role files nothing imports (handlers, publishers, jobs, adapters, controllers...), in one
 * pattern with the published language, which every context has from its first minute, and with
 * the generated file that registers what their constructors take, which discovery loads with
 * them and which a context has once one of its classes takes something.
 */
export function declareContextEntries(ws: Workspace, config: Config): void {
  if (ws.read(KNIP_FILE) === undefined) {
    return;
  }

  editJson(ws, KNIP_FILE, (file) => {
    const knip = knipProject(file);
    const entries: unknown[] = Array.isArray(knip['entry']) ? knip['entry'] : [];

    if (!entries.some((entry) => typeof entry === 'string' && entry.includes(PUBLISHED_LANGUAGE))) {
      knip['entry'] = [...contextEntries(config), ...entries];
    }
  });
}

function contextEntries(config: Config): string[] {
  const contexts = `${config.contextsDir}/*`;

  if (config.stack.assembly === 'discovery' && isDeclared(config)) {
    const roles = `{application,infrastructure}/**/*.{${DISCOVERED_SUFFIXES.join(',')}}`;
    const edge = `presentation/**/*.{${EDGE_SUFFIXES.join(',')}}`;

    return [`${contexts}/{${PUBLISHED_LANGUAGE},*.dependencies,${roles},${edge}}.ts`];
  }

  return [...(isDeclared(config) ? [] : [`${contexts}/*.module.ts`]), `${contexts}/${PUBLISHED_LANGUAGE}.ts`];
}
