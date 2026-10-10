import type { ValidationIssue } from '@ddd-ts-kit/validation';

export function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}
