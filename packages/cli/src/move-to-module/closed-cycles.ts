import { importedModules } from '../check/modules/imported-modules';
import type { ModuleImport } from '../check/modules/module-imports';
import { cyclesIn } from '../check/support/cycles-in';

/** One step of a cycle between modules: the imports that make one module depend on the next. */
export interface CycleStep {
  readonly from: string;
  readonly to: string;
  /** True when no file of `from` imported `to` before the move. */
  readonly added: boolean;
  readonly imports: readonly ModuleImport[];
}

/** A cycle between the modules of a context that a move closes: its modules in order, the last one importing the first. */
export interface ClosedCycle {
  readonly modules: readonly string[];
  readonly steps: readonly CycleStep[];
}

/**
 * The cycles a move closes, read from the imports between the modules of one context before it
 * and after it: one cycle through each dependency of a module on another that the move adds.
 * A cycle whose every step was there before the move is not of the move, and is not answered.
 */
export function closedCycles(before: readonly ModuleImport[], after: readonly ModuleImport[]): ClosedCycle[] {
  const was = new Set(before.map(stepKey));
  const added = new Map(after.filter((one) => !was.has(stepKey(one))).map((one) => [stepKey(one), one]));
  const cycles = new Map<string, string[]>();

  for (const cycle of [...added.values()].flatMap((step) => cycleThrough(step, after))) {
    cycles.set(cycle.join(' '), cycle);
  }

  return [...cycles.values()].map((modules) => ({
    modules,
    steps: modules.map((from, at) => stepOf({ from, to: modules[(at + 1) % modules.length] ?? '' }, { was, after })),
  }));
}

/** A dependency of one module on another. */
type Step = Pick<ModuleImport, 'from' | 'to'>;

function stepKey({ from, to }: Step): string {
  return `${from} ${to}`;
}

/**
 * The shortest cycle that goes through a step, its modules from the first in the alphabet, none when
 * the step closes no cycle. Whether it closes one is the search of `module/no-cycle` (`cyclesIn`),
 * started on the module the step leaves and made to leave it by that step alone; the cycle told is
 * then the shortest way back from the module the step reaches.
 */
function cycleThrough({ from, to }: Step, after: readonly ModuleImport[]): string[][] {
  const imported = importedModules(after);
  const next = (module: string): string[] => (module === from ? [to] : imported(module));
  const closes = cyclesIn([from], next).some(([first]) => first === from);

  return closes ? [fromTheFirst([from, ...shortestWay({ from: to, to: from }, imported)])] : [];
}

/**
 * The modules of the shortest way from one module to another it reaches, the first included and the
 * last left out: every way one step longer is tried at once, each module entered once, the modules in
 * the order of the alphabet so that two ways of one length always give the same one.
 */
function shortestWay({ from, to }: Step, imported: (module: string) => string[]): string[] {
  const entered = new Set([from]);
  let ways = [[from]];

  while (!ways.some((way) => imported(way.at(-1) ?? '').includes(to))) {
    ways = ways.flatMap((way) =>
      imported(way.at(-1) ?? '')
        .filter((module) => !entered.has(module))
        .sort()
        .map((module) => {
          entered.add(module);

          return [...way, module];
        }),
    );
  }

  return ways.find((way) => imported(way.at(-1) ?? '').includes(to)) ?? [];
}

/** The same cycle, told from its first module in the alphabet: two steps of one cycle then answer it once. */
function fromTheFirst(cycle: readonly string[]): string[] {
  const at = cycle.indexOf([...cycle].sort()[0] ?? '');

  return [...cycle.slice(at), ...cycle.slice(0, at)];
}

/** What a step is read against: the dependencies there before the move, and the imports after it. */
interface Read {
  readonly was: ReadonlySet<string>;
  readonly after: readonly ModuleImport[];
}

function stepOf(step: Step, { was, after }: Read): CycleStep {
  return {
    ...step,
    added: !was.has(stepKey(step)),
    imports: after.filter((one) => one.from === step.from && one.to === step.to),
  };
}
