import type { DoctorFinding } from './doctor-finding.js';
import { inRange } from './in-range.js';

/** A version `.nvmrc` names, as nvm reads it: `22`, `22.12` or `v22.12.0`. An alias such as `lts/*` is not judged. */
const NVMRC_VERSION = /^v?\d+(?:\.\d+){0,2}$/;

/**
 * The running Node against what the project asks: `engines.node` of package.json, the range it
 * runs on, then the version `.nvmrc` names, the one its team works with.
 */
export function nodeFindings(running: string, engines: unknown, nvmrc: string | undefined): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  if (typeof engines === 'string' && inRange(running, engines) === false) {
    findings.push({ area: 'node', name: 'engines.node', problem: 'unsupported', expected: engines, found: running });
  }

  const named = nvmrc?.trim() ?? '';

  if (NVMRC_VERSION.test(named) && inRange(running, named) === false) {
    findings.push({ area: 'node', name: '.nvmrc', problem: 'other version', expected: named, found: running });
  }

  return findings;
}
