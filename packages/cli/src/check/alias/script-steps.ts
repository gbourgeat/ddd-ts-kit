/** The compiler, called by its name, by its path or through a wrapper script named after it. */
const COMPILES = /(?:^|[\s/])tsc(?:\.[cm]?js)?(?=\s|$)/;
const TYPE_CHECK_ONLY = /--noEmit(?:\s|$)/;
/** The build of the clients `ddd-ts-kit sdk` generates: their sources import one another by relative paths, no alias. */
const BUILDS_CLIENTS = /\s-[bp]\s+(?:\.\/)?clients(?:\/|\s|$)/;
/** The configuration a step gives the compiler: a file, or a directory that holds a tsconfig.json. */
const PROJECT = /\s(?:-p|--project|-b|--build)[=\s]+(?:\.\/)?([^\s-]\S*)/;
/** What the compiler reads when a step names none. */
const DEFAULT_PROJECT = 'tsconfig.json';

/** One step of a script of package.json. */
export interface ScriptStep {
  readonly text: string;
  /** It compiles what ships: not a type check, nor the build of the generated clients. */
  readonly compiles: boolean;
  /** The tsconfig it gives the compiler, from the project root: `tsconfig.json` when it names none. */
  readonly project: string;
}

/** The steps of a script, as `&&` chains them, with what each one compiles. */
export function scriptSteps(command: string): ScriptStep[] {
  return command.split('&&').map((step) => {
    const text = step.trim();
    const compiles = COMPILES.test(text) && !TYPE_CHECK_ONLY.test(text) && !BUILDS_CLIENTS.test(text);

    return { text, compiles, project: projectOf(text) };
  });
}

function projectOf(step: string): string {
  const given = PROJECT.exec(step)?.[1]?.replace(/\/$/, '') ?? DEFAULT_PROJECT;

  return given.endsWith('.json') ? given : `${given}/${DEFAULT_PROJECT}`;
}
