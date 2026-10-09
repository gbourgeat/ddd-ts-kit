export { run, VERSION, type Io } from './cli.js';
export { runCheck, type CheckOptions, type CheckResult } from './check/engine.js';
export { loadProject } from './check/project.js';
export { RULE_IDS, RULES } from './check/rules/index.js';
export type { Project, Rule, Violation } from './check/types.js';
