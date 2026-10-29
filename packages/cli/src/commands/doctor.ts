import { readConfig } from '../config';
import { diagnose } from '../doctor/diagnose';
import type { DoctorFinding } from '../doctor/doctor-finding';
import { formatDiagnosis } from '../doctor/format-diagnosis';
import { VERSION } from '../version';
import { Arguments } from './arguments';
import type { Command } from './command';
import { stdoutJson } from '../json/stdout-json';

/**
 * What --strict fails on: what the project lacks, and what keeps this checkout from running it.
 * A script written otherwise may be the project's on purpose, a git hook not installed is a state
 * of one clone, the Node `.nvmrc` names is a choice of the team when `engines.node` accepts the
 * running one, a lockfile changed after the install may hold what node_modules has, the
 * generators read the files of the platform flat as well as in their folders, and an override no
 * longer needed forces a version the dependency asks for anyway.
 */
const STRICT_PROBLEMS: Readonly<Record<DoctorFinding['area'], ReadonlySet<DoctorFinding['problem']>>> = {
  script: new Set(['missing']),
  package: new Set(['missing', 'other version']),
  permission: new Set(['missing']),
  hook: new Set(['missing']),
  guidance: new Set(['missing']),
  folder: new Set(),
  node: new Set(['unsupported']),
  install: new Set(['missing', 'not installed', 'other version']),
  submodule: new Set(['not initialised']),
  override: new Set(['missing']),
  // A denial may be the team's on purpose; a script left unreviewed by the last bump is not.
  'install-script': new Set(['missing', 'other version']),
};

/**
 * What an upgrade left to do in the project: the scripts, packages, permissions and git hooks this
 * version writes and it lacks; then what this checkout lacks to run it: Node, dependencies, submodules.
 */
export const doctorCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { strict: { type: 'boolean', default: false } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const findings = diagnose(root, config);

  io.out(
    args.json
      ? stdoutJson({ version: VERSION, findings })
      : formatDiagnosis(findings, VERSION, config.stack.packageManager),
  );

  return args.flag('strict') && findings.some((finding) => STRICT_PROBLEMS[finding.area].has(finding.problem)) ? 1 : 0;
};
