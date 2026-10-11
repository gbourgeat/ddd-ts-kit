import type { Config } from '../../config/index.js';
import { architectureFiles } from './architecture-files.js';
import { auditFiles } from './audit-files.js';
import { authFiles } from './auth-files.js';
import { endToEndFiles } from './end-to-end-files.js';
import { guidanceFiles } from './guidance-files.js';
import type { InitFile } from './init-file.js';
import { persistenceFiles } from './persistence-files.js';
import { pipelineFiles } from './pipeline-files.js';
import { platformFiles } from './platform-files.js';
import { projectFiles } from './project-files.js';
import { scriptFiles } from './script-files.js';

export function initFiles(config: Config, projectName: string): InitFile[] {
  return [
    ...projectFiles(config, projectName),
    ...platformFiles(config),
    ...auditFiles(config),
    ...authFiles(config),
    ...persistenceFiles(config),
    ...scriptFiles(config),
    ...endToEndFiles(config),
    ...architectureFiles(config),
    ...pipelineFiles(config),
    ...guidanceFiles(),
  ];
}
