import type { Config } from '../../config';
import { architectureFiles } from './architecture-files';
import { auditFiles } from './audit-files';
import { authFiles } from './auth-files';
import { endToEndFiles } from './end-to-end-files';
import { guidanceFiles } from './guidance-files';
import type { InitFile } from './init-file';
import { persistenceFiles } from './persistence-files';
import { pipelineFiles } from './pipeline-files';
import { platformFiles } from './platform-files';
import { privacyFiles } from './privacy-files';
import { projectFiles } from './project-files';
import { scriptFiles } from './script-files';

export function initFiles(config: Config, projectName: string): InitFile[] {
  return [
    ...projectFiles(config, projectName),
    ...platformFiles(config),
    ...auditFiles(config),
    ...privacyFiles(config),
    ...authFiles(config),
    ...persistenceFiles(config),
    ...scriptFiles(config),
    ...endToEndFiles(config),
    ...architectureFiles(config),
    ...pipelineFiles(config),
    ...guidanceFiles(),
  ];
}
