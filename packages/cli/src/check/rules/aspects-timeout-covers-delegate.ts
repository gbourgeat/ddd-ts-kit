import { parameterShape } from '../../declared/injection/parameter-shape';
import { rawClassName } from '../../declared/injection/raw-class-name';
import { adapterPolicies } from '../aspects/adapter-policies';
import type { AdapterPolicy } from '../aspects/adapter-policy';
import { statedTimeouts } from '../aspects/stated-timeouts';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import type { ClassShape } from '../structure/class-shape';
import { perFile } from '../support/per-file';

/** The kinds the default policy of the platform goes around (`resilience/default-policy.ts`). */
const DEFAULTED_KINDS = ['external', 'gateway'];
const DEFAULT_SETTINGS = '/resilience/default-resilience-settings.ts';
const DEFAULT_TIMEOUT = /(?<![\w$.])timeoutMs\s*:\s*(\d[\d_]*)/;

interface Adapter {
  readonly policy: AdapterPolicy;
  readonly file: SourceFile;
  readonly shape: ClassShape;
}

/** A time limit, and who states it. */
interface Limit {
  readonly ms: number;
  readonly statedBy: string;
}

export const aspectsTimeoutCoversDelegate: Rule = {
  id: 'aspects/timeout-covers-delegate',
  description:
    'An adapter that is given a port (a constructor parameter typed by it) is not cut before the adapter bound to that port: its time limit, the `timeout(<ms>)` of its `ownPolicy(...)` or, for an `external` or `gateway` adapter that states none, the default of the platform (`timeoutMs` of `resilience/default-resilience-settings.ts`), is at least the limit the adapter behind the port states for itself. Read from the declarations (`@Adapter`, `@Gateway`), the bindings of the container of the kit and the `@Timeout` of the methods, where the durations are written as numbers.',
  scope: 'project',
  run(project) {
    const adapters = adaptersOf(project);
    const fallback = defaultTimeout(project);
    const found = new Map<string, Finding[]>();

    for (const outer of adapters) {
      const cut = injectedOf(outer.shape).flatMap((port) =>
        cutShort(outer, servingOf(adapters, port, outer), fallback),
      );

      found.set(outer.file.path, [...(found.get(outer.file.path) ?? []), ...cut]);
    }

    return perFile(project, this.id, (file) => unique(found.get(file.path) ?? []));
  },
};

/** Each stated policy with the class it governs, found by its name among the classes of the sources. */
function adaptersOf(project: Project): Adapter[] {
  const sources = project.files.filter((file) => !file.isTest);

  return adapterPolicies(project).flatMap((policy) => {
    for (const file of sources) {
      const shape = file.structure.classes.find(({ name, depth }) => depth === 0 && name === policy.className);

      if (shape !== undefined) {
        return [{ policy, file, shape }];
      }
    }

    return [];
  });
}

/** `timeoutMs` of the default settings of the platform; undefined in a project without them. */
function defaultTimeout(project: Project): number | undefined {
  const settings = project.files.find(
    ({ location, path }) => location.area === 'platform' && path.endsWith(DEFAULT_SETTINGS),
  );

  const written = settings === undefined ? undefined : DEFAULT_TIMEOUT.exec(settings.scan.code)?.[1];

  return written === undefined ? undefined : Number(written.replaceAll('_', ''));
}

/** The classes that type the constructor parameters of an adapter: what the container gives it. */
function injectedOf(shape: ClassShape): string[] {
  const parameters = shape.methods.find((method) => method.isConstructor)?.parameters ?? [];

  return parameters.flatMap((parameter) => rawClassName(parameterShape(parameter).type ?? '') ?? []);
}

function servingOf(adapters: readonly Adapter[], port: string, outer: Adapter): { port: string; inner: Adapter }[] {
  return adapters
    .filter(({ policy }) => policy.port === port && policy.className !== outer.policy.className)
    .map((inner) => ({ port, inner }));
}

function cutShort(
  outer: Adapter,
  serving: readonly { port: string; inner: Adapter }[],
  fallback: number | undefined,
): Finding[] {
  const ceiling = ceilingOf(outer, fallback);

  return serving.flatMap(({ port, inner }) => {
    const floor = floorOf(inner, fallback);

    return ceiling === undefined || floor === undefined || ceiling.ms >= floor.ms
      ? []
      : [finding({ outer, port, inner: inner.policy.className }, { ceiling, floor })];
  });
}

/**
 * The longest one attempt of the adapter may last: the shortest limit around all its methods (its
 * stated ones, the default of its kind when it states no policy of its own), else the longest of
 * its `@Timeout`, the methods being cut one by one. Undefined when nothing cuts it, or when a
 * duration is not a number the text shows.
 */
function ceilingOf({ policy, file, shape }: Adapter, fallback: number | undefined): Limit | undefined {
  const methods = statedTimeouts(file.scan.code.slice(shape.bodyStart, shape.end), 'Timeout');
  const around = aroundOf(policy, fallback);

  if (!policy.readable || !methods.readable) {
    return undefined;
  }

  if (around.length > 0) {
    return shortest(around);
  }

  return methods.timeouts.length === 0
    ? undefined
    : { ms: Math.max(...methods.timeouts), statedBy: 'the longest `@Timeout` of its methods' };
}

/** The shortest limit the adapter behind a port states for itself; undefined when it states none it can be read by. */
function floorOf({ policy, file, shape }: Adapter, fallback: number | undefined): Limit | undefined {
  const methods = statedTimeouts(file.scan.code.slice(shape.bodyStart, shape.end), 'Timeout');
  const stated = [...policy.timeouts, ...methods.timeouts];

  if (!policy.readable || !methods.readable || stated.length === 0) {
    return undefined;
  }

  return shortest([
    ...aroundOf(policy, fallback),
    ...methods.timeouts.map((ms) => ({ ms, statedBy: 'its `@Timeout`' })),
  ]);
}

/** The limits around every method of an adapter: those its declaration or binding states, and the default one. */
function aroundOf(policy: AdapterPolicy, fallback: number | undefined): Limit[] {
  const defaulted = !policy.ownPolicy && fallback !== undefined && DEFAULTED_KINDS.includes(policy.kind ?? '');

  return [
    ...policy.timeouts.map((ms) => ({ ms, statedBy: 'its own policy' })),
    ...(defaulted
      ? [{ ms: fallback, statedBy: `the default policy of the ${policy.kind ?? ''} adapters, which it never chose` }]
      : []),
  ];
}

function shortest(limits: readonly Limit[]): Limit | undefined {
  return [...limits].sort((left, right) => left.ms - right.ms)[0];
}

function finding(
  { outer, port, inner }: { outer: Adapter; port: string; inner: string },
  { ceiling, floor }: { ceiling: Limit; floor: Limit },
): Finding {
  const name = outer.policy.className;

  return {
    line: outer.shape.line,
    message: `${name} is cut after ${ceiling.ms} ms (${ceiling.statedBy}) and is given ${port}, which ${inner} serves with a limit of ${floor.ms} ms: a call ${inner} would still answer fails in ${name} first, as a timeout of ${name}.`,
    fix: `State the policy of ${name} where it is declared or bound, at least as long as the adapter it calls: \`ownPolicy(timeout(${floor.ms}))\`; or \`ownPolicy()\` alone when it only hands the call over, ${inner} carrying the policy.`,
  };
}

function unique(findings: readonly Finding[]): Finding[] {
  return findings.filter(
    (candidate, index) => findings.findIndex((other) => other.message === candidate.message) === index,
  );
}
