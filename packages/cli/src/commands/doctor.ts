import { readConfig } from '../config/index.js';
import { diagnose } from '../doctor/diagnose.js';
import type { DoctorFinding } from '../doctor/doctor-finding.js';
import { formatDiagnosis } from '../doctor/format-diagnosis.js';
import { VERSION } from '../version.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** What --strict fails on: a script written otherwise may be the project's on purpose, and a hook is a state of one clone. */
const STRICT_PROBLEMS: ReadonlySet<DoctorFinding['problem']> = new Set(['missing', 'other version']);

/** What an upgrade left to do in the project: the scripts, packages, permissions and git hooks this version writes and it lacks. */
export const doctorCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { strict: { type: 'boolean', default: false } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const findings = diagnose(root, config);

  io.out(
    args.json
      ? JSON.stringify({ version: VERSION, findings }, null, 2)
      : formatDiagnosis(findings, VERSION, config.stack.packageManager),
  );

  return args.flag('strict') && findings.some((finding) => STRICT_PROBLEMS.has(finding.problem)) ? 1 : 0;
};
