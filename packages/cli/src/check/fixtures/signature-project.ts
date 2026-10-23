import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { DECLARED } from './declared';
import { declaredProject } from './declared-project';
import type { FixtureFiles } from './fixture-files';
import { handler } from './handler';
import { PATHS } from './paths';

type Assembly = 'barrel' | 'discovery';

/**
 * A declared project that states dependencies in constructor signatures, holding the
 * issue-invoice use case with the handler it is given. Its declarations are the ones the
 * generator derives from the role files alone: a fixture whose handler is injected something
 * writes the generated file of its folder out, so that it does not prove the rule with its own code.
 */
export function signatureProject(
  body: string,
  overrides: FixtureFiles = {},
  assembly: Assembly = 'barrel',
): FixtureFiles {
  const stack = { style: 'declared', dependencies: 'signature', assembly };

  const files = declaredProject(
    { [PATHS.REPOSITORY_PORT]: DECLARED.repositoryPort, [PATHS.COMMAND]: DECLARED.command, ...handler(body) },
    { [CONFIG_FILE]: config({ stack }), ...overrides },
  );

  return assembly === 'barrel' ? files : withoutBarrels(files);
}

function withoutBarrels(files: FixtureFiles): FixtureFiles {
  return Object.fromEntries(Object.entries(files).filter(([file]) => !file.endsWith('.declarations.ts')));
}
