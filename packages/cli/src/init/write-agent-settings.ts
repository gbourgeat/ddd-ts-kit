import type { Workspace } from '../workspace/index.js';
import { isRecord } from './is-record.js';
import { formatJson } from '../json/format-json.js';

const AGENT_SETTINGS = '.claude/settings.json';

type Permissions = Readonly<Record<'allow' | 'deny' | 'ask', readonly string[]>>;

/**
 * What an agent may do in the project without asking, what it never does, and what it asks
 * for. Permissions only: nothing here changes how the agent behaves otherwise.
 */
const PERMISSIONS: Permissions = {
  allow: [
    'Bash(npx ddd-ts-kit check *)',
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
    'Bash(npm run docs:generate)',
    'Bash(npm run docs:check)',
    'Bash(npm run openapi:generate)',
    'Bash(npm run openapi:check)',
    'Bash(npm run events:generate)',
    'Bash(npm run events:check)',
  ],
  // Secrets, then the generated contracts: those are regenerated, never edited. In a deny
  // list, a pattern starting with `!` carves its matches out of the rules before it
  // (gitignore negation), which keeps `.env.example`, documentation, readable.
  deny: [
    'Read(./.env)',
    'Read(./.env.*)',
    'Read(!./.env.example)',
    'Edit(./openapi/openapi.json)',
    'Edit(./docs/integration/asyncapi.json)',
    'Edit(./docs/integration/event-catalog.md)',
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
  ],
};

/** Creates the settings, or adds the missing permissions to the ones the project already has, and says which. */
export function writeAgentSettings(ws: Workspace): void {
  const existing = ws.read(AGENT_SETTINGS);

  if (existing === undefined) {
    ws.create(AGENT_SETTINGS, serialize({ permissions: PERMISSIONS }));

    return;
  }

  const settings = parse(existing);

  if (settings === undefined) {
    ws.note(`${AGENT_SETTINGS} is not a JSON object: it was left as it is.`);

    return;
  }

  const merged = mergePermissions(settings);

  ws.update(AGENT_SETTINGS, serialize(merged.settings));

  if (merged.added.length > 0) {
    ws.note(`${AGENT_SETTINGS} gained ${merged.added.length} permission(s): ${merged.added.join(', ')}.`);
  }
}

const serialize = (settings: unknown): string => formatJson(settings);

function parse(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function mergePermissions(settings: Record<string, unknown>): { settings: Record<string, unknown>; added: string[] } {
  const current = isRecord(settings['permissions']) ? settings['permissions'] : {};
  const added: string[] = [];
  const permissions: Record<string, unknown> = { ...current };

  for (const [kind, wanted] of Object.entries(PERMISSIONS)) {
    const present: unknown[] = Array.isArray(current[kind]) ? current[kind] : [];
    const missing = wanted.filter((rule) => !present.includes(rule));

    permissions[kind] = [...present, ...missing];
    added.push(...missing.map((rule) => `${kind} ${rule}`));
  }

  return { settings: { ...settings, permissions }, added };
}
