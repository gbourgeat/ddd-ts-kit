type AgentPermissions = Readonly<Record<'allow' | 'deny' | 'ask', readonly string[]>>;

/**
 * What an agent may do in the project without asking, what it never does, and what it asks
 * for. Permissions only: nothing here changes how the agent behaves otherwise.
 */
export const AGENT_PERMISSIONS: AgentPermissions = {
  allow: [
    'Bash(npx ddd-ts-kit check *)',
    'Bash(npx ddd-ts-kit verify-slice *)',
    'Bash(npx ddd-ts-kit cited *)',
    'Bash(npx ddd-ts-kit acceptance *)',
    'Bash(npx ddd-ts-kit story *)',
    'Bash(npx ddd-ts-kit story-scope *)',
    'Bash(npx ddd-ts-kit stories)',
    'Bash(npx ddd-ts-kit stories *)',
    'Bash(npx ddd-ts-kit worktree *)',
    'Bash(npx ddd-ts-kit verify-merge)',
    'Bash(npx ddd-ts-kit verify-merge *)',
    'Bash(npx ddd-ts-kit story-check *)',
    'Bash(npx ddd-ts-kit merge-trunk)',
    'Bash(npx ddd-ts-kit merge-trunk *)',
    'Bash(npx ddd-ts-kit list *)',
    'Bash(npx ddd-ts-kit generate *)',
    'Bash(npx ddd-ts-kit docs *)',
    'Bash(npx ddd-ts-kit explain *)',
    'Bash(npx ddd-ts-kit rules)',
    'Bash(npm run verify)',
    'Bash(npm run typecheck)',
    'Bash(npm run lint *)',
    'Bash(npm test *)',
    'Bash(npm run test:e2e *)',
    'Bash(npm run regenerate)',
    'Bash(npm run docs:generate)',
    'Bash(npm run docs:check)',
    'Bash(npm run openapi:generate)',
    'Bash(npm run openapi:check)',
    'Bash(npm run events:generate)',
    'Bash(npm run events:check)',
  ],
  // Secrets, then the generated contracts: those are regenerated, never edited, and the lock of
  // an acceptance, which `ddd-ts-kit acceptance <story> --lock` alone writes. In a deny
  // list, a pattern starting with `!` carves its matches out of the rules before it
  // (gitignore negation), which keeps `.env.example`, documentation, readable.
  deny: [
    'Read(./.env)',
    'Read(./.env.*)',
    'Read(!./.env.example)',
    'Edit(./openapi/**)',
    'Edit(./docs/integration/asyncapi.*)',
    'Edit(./docs/integration/event-catalog.md)',
    'Edit(./test/acceptance/*.acceptance.lock.json)',
  ],
  // Then the files that hold the rules and the pipeline: changing one is a decision of the
  // project owner, the same list as the editor hook of the plugin asks about.
  ask: [
    'Bash(git push *)',
    'Bash(npm publish *)',
    'Edit(./ddd-ts-kit.config.json)',
    'Edit(./eslint.config.mjs)',
    'Edit(./biome.json)',
    'Edit(./.dependency-cruiser.cjs)',
    'Edit(./knip.json)',
    'Edit(./lefthook.yml)',
    'Edit(./.gitlab-ci.yml)',
    'Edit(./.github/workflows/**)',
    'Edit(./.claude/settings.json)',
    'Edit(./.github/copilot/settings.json)',
  ],
};
