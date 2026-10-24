import type { Project } from '../model/project';

/**
 * The `privacy/*` rules judge a project whose platform answers the requests of a data subject
 * (`stack.privacy: "on"`): a project that chose `off`, or whose config was written before the
 * choice existed, said it keeps no personal data, and nothing is asked of it.
 */
export function privacyJudged(project: Project): boolean {
  return project.config.stack.privacy === 'on';
}
