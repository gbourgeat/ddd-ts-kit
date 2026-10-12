import { formatJson } from '../json/format-json.js';
import type { Workspace } from '../workspace/index.js';

/**
 * Rewrites a JSON file of the project through `edit`, laid out as the formatter would. A file
 * that is absent is left so; one that is not plain JSON (comments, a trailing comma) is not
 * rewritten, and what it lacks is said.
 */
export function editJsonFile(
  ws: Workspace,
  file: string,
  edit: (value: Record<string, unknown>) => Record<string, unknown>,
): void {
  const text = ws.read(file);

  if (text === undefined) {
    return;
  }

  const value = parsed(text);

  if (value === undefined) {
    ws.note(
      `${file} is not plain JSON: \`ddd-ts-kit sdk\` left it as it is. Compare it with what the command writes in a new project (docs/CONFIG.md, "sdk").`,
    );

    return;
  }

  ws.update(file, formatJson(edit(value)));
}

function parsed(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);

    return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : undefined;
  } catch {
    return undefined;
  }
}
