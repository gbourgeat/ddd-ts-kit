import { backgroundJobPolicy, type BackgroundJobPolicy } from '@ddd-ts-kit/kernel';
import type { BackgroundJobDefinition } from './background-job-definition';

/** A background job a worker knows, its options read once. */
export class RegisteredBackgroundJob {
  readonly policy: BackgroundJobPolicy;

  constructor(readonly definition: BackgroundJobDefinition) {
    this.policy = backgroundJobPolicy(definition.options);
  }

  get name(): string {
    return this.definition.name;
  }

  get queue(): string {
    return this.definition.name.split('.', 1).join('');
  }
}
