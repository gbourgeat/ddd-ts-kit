import type { WrittenMigration } from './written-migration';

/** One run of drizzle-kit generate: its exit code and what it wrote under the migrations folder. */
export interface DrizzleRun {
  readonly code: number;
  readonly written: WrittenMigration;
}
