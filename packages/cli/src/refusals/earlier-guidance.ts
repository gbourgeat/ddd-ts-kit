import type { MigrationDraft } from './migration-draft';

/** The guides `init` writes for agents that say how a refusal is built: the rules by layer, and the guide of every agent. */
const GUIDES = [
  '.claude/rules/domain.md',
  '.claude/rules/presentation.md',
  '.github/instructions/domain.instructions.md',
  '.github/instructions/presentation.instructions.md',
  'AGENTS.md',
];

/** What only a guide written for classes per error or for factories of concept classes says. */
const EARLIER_FORM = /\bConceptError\b|\bDomainError\b|\bdomain-error\b|\brefusal\(code\b|as their factories set them/;

/**
 * Tells each guide of the agents that still describes the earlier form: an agent that reads it
 * would write the refusals the project just left. No command writes them again alone (`init
 * --force` rewrites the whole platform), and a team may have written in them: a person rewrites them.
 */
export function earlierGuidance(draft: MigrationDraft): void {
  for (const guide of GUIDES.filter((file) => EARLIER_FORM.test(draft.read(file) ?? ''))) {
    draft.manual.push(
      `${guide} still describes the earlier form of the refusals: rewrite it from the named form (one class per refusal, its code in codes.ts, its factories).`,
    );
  }
}
