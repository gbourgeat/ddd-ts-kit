import { scan } from '../check/scan/scan.js';

const KERNEL_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@ddd-ts-kit\/kernel';[ \t]*\n?/;
const TESTING_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@ddd-ts-kit\/testing';/;
const RESULT_HELPERS = ['err', 'ok', 'Result', 'unwrap'];
const LAST_IMPORT = /^import[^;]*;[ \t]*$/gm;

/**
 * Drops `err`, `ok`, `Result` and `unwrap` from the import of the kernel once nothing reads them,
 * and imports `expectRefusal` where an assertion now calls it.
 */
export function tidyImports(source: string): string {
  return importExpectRefusal(withoutUnusedHelpers(source));
}

function withoutUnusedHelpers(source: string): string {
  const found = KERNEL_IMPORT.exec(source);

  if (found === null) {
    return source;
  }

  const rest = scan(source.slice(0, found.index) + source.slice(found.index + found[0].length)).code;
  const listed = (found[1] ?? '').split(',').filter((name) => name.trim().length > 0);
  const kept = listed.filter((name) => isKept(name, rest));

  if (kept.length === listed.length) {
    return source;
  }

  if (kept.length === 0) {
    return source.slice(0, found.index) + source.slice(found.index + found[0].length);
  }

  const names = kept.map((name) => name.trim()).join(', ');

  return source.replace(KERNEL_IMPORT, `import { ${names} } from '@ddd-ts-kit/kernel';\n`);
}

function isKept(name: string, code: string): boolean {
  const bare = name.replace(/^\s*type\s+/, '').trim();

  return !RESULT_HELPERS.includes(bare) || new RegExp(`(?<![\\w$.])${bare}(?![\\w$])`).test(code);
}

function importExpectRefusal(source: string): string {
  const { code } = scan(source);

  if (!/(?<![\w$.])expectRefusal\s*\(/.test(code) || /\bexpectRefusal\b/.test(code.slice(0, lastImportEnd(source)))) {
    return source;
  }

  const testing = TESTING_IMPORT.exec(source);

  if (testing !== null) {
    return source.replace(
      TESTING_IMPORT,
      `import { ${[...(testing[1] ?? '').split(','), ' expectRefusal']
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .join(', ')} } from '@ddd-ts-kit/testing';`,
    );
  }

  const end = lastImportEnd(source);

  return `${source.slice(0, end)}\nimport { expectRefusal } from '@ddd-ts-kit/testing';${source.slice(end)}`;
}

function lastImportEnd(source: string): number {
  const imports = [...source.matchAll(LAST_IMPORT)];
  const last = imports.at(-1);

  return last === undefined ? 0 : last.index + last[0].length;
}
