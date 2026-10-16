import { readConfig } from '../config/index.js';
import { diagnose } from '../doctor/diagnose.js';
import { formatDiagnosis } from '../doctor/format-diagnosis.js';
import { VERSION } from '../version.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** What an upgrade left to do in the project: the scripts, packages and permissions this version writes and it lacks. */
export const doctorCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { strict: { type: 'boolean', default: false } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const findings = diagnose(root, config);

  io.out(args.json ? JSON.stringify({ version: VERSION, findings }, null, 2) : formatDiagnosis(findings, VERSION));

  return args.flag('strict') && findings.some((finding) => finding.problem !== 'written otherwise') ? 1 : 0;
};
