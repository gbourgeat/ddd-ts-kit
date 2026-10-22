import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { perFile } from '../support/per-file';
import { isModelFile } from '../values/is-model-file';
import { isValueObjectFile } from '../values/is-value-object-file';
import { plainValueFunctions } from '../values/plain-value-functions';
import { valueObjectFileFindings } from '../values/value-object-file-findings';

export const domainValueObjectClass: Rule = {
  id: 'domain/value-object-class',
  description:
    'Under "stack.values": "classes", a value object is a class: a file of domain/value-objects/ (or a *.vo.ts of the shared kernel) exports one class extending ValueObject, with a private or protected constructor and static factories, and no function or object literal; no exported function of domain/ or of the shared kernel answers a record of data (no spread, nothing a call of the model built).',
  scope: 'file',
  run(project) {
    return project.config.stack.values === 'classes' ? perFile(project, this.id, (file) => judge(project, file)) : [];
  },
};

function judge(project: Project, file: SourceFile): Finding[] {
  const { sharedKernelDir } = project.config;

  if (isValueObjectFile(file.path, file.location, sharedKernelDir)) {
    return valueObjectFileFindings(file, sharedKernelDir);
  }

  return isModelFile(file.path, file.location, sharedKernelDir) && !file.isTest ? plainValueFunctions(file) : [];
}
