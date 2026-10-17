import { toName } from '../../../naming/index.js';
import type { Scope } from '../../scope.js';
import { constructorParameters } from '../job/constructor-parameters.js';
import { declaredPorts, type DeclaredPort } from './declared-ports.js';
import { fakeClass } from './fake-class.js';
import { portsInUse } from './ports-in-use.js';

/** A fake of `test/fakes/` a world can build alone, and the port of the context it stands for. */
export interface ContextFake {
  /** The exported class of the fake. */
  readonly name: string;
  /** Its file, from the project root. */
  readonly file: string;
  readonly port: DeclaredPort;
  /** The camel name of the port: the key the world returns the fake under. */
  readonly key: string;
}

export interface ContextFakes {
  readonly fakes: readonly ContextFake[];
  /** Why a file of `test/fakes/` is not in the world, one sentence each. */
  readonly leftOut: readonly string[];
}

const FAKE_SUFFIX = '.fake.ts';

/**
 * The fakes of a context, read from `test/fakes/*.fake.ts`: the class each file exports, and the
 * port of the context it implements or extends, declared in `domain/repositories/` or
 * `application/ports/`. Left out: a fake whose constructor needs an argument; one that stands for
 * no port of the context, or, under a container, for a port nothing of the context binds or
 * depends on yet, which the test application refuses; a second fake of a port, the one named
 * after the port being kept.
 */
export function contextFakes(scope: Scope): ContextFakes {
  const ports = declaredPorts(scope);
  // Only a container checks that a fake stands for something it binds: the buses take any fake.
  const inUse = scope.config.stack.di === 'tsyringe' ? portsInUse(scope, [...ports.values()]) : new Set(ports.keys());
  const directory = `${scope.dir}/test/fakes`;

  const judged = scope.ws
    .list(directory)
    .filter((name) => name.endsWith(FAKE_SUFFIX))
    .map((name) => judge(`${directory}/${name}`, scope.ws.read(`${directory}/${name}`) ?? '', { ports, inUse }));

  const found = judged.filter((fake): fake is ContextFake => typeof fake !== 'string');
  const fakes = found.filter((fake) => chosen(found, fake.key) === fake);

  const leftOut = [
    ...judged.filter((reason): reason is string => typeof reason === 'string'),
    ...found
      .filter((fake) => !fakes.includes(fake))
      .map(
        (fake) =>
          `${fake.name} stands for ${fake.port.name}, which ${chosen(found, fake.key)?.name ?? ''} already fakes.`,
      ),
  ];

  return { fakes, leftOut };
}

interface KnownPorts {
  readonly ports: ReadonlyMap<string, DeclaredPort>;
  readonly inUse: ReadonlySet<string>;
}

/** The fake of a port: the one named after it (`FakeInvoiceRepository`), or the first found. */
function chosen(found: readonly ContextFake[], key: string): ContextFake | undefined {
  const candidates = found.filter((fake) => fake.key === key);

  return candidates.find((fake) => fake.name === `Fake${fake.port.name}`) ?? candidates[0];
}

/** The fake of a file, or why the world leaves it out. */
function judge(file: string, source: string, { ports, inUse }: KnownPorts): ContextFake | string {
  const found = fakeClass(source);

  if (found === undefined) {
    return `${file} exports no class.`;
  }

  const port = found.candidates.map((candidate) => ports.get(candidate)).find((known) => known !== undefined);

  if (port === undefined) {
    return `${found.name} implements no port of the context (domain/repositories/ or application/ports/).`;
  }

  if (!inUse.has(port.name)) {
    return `${found.name} stands for ${port.name}, which no class of the context implements or depends on yet: the test application would refuse its fake. Run again with --force once one does.`;
  }

  if (constructorParameters(source).some(isRequired)) {
    return `${found.name} needs constructor arguments: a spec builds it with what it should answer.`;
  }

  return { name: found.name, file, port, key: toName(port.name).camel };
}

/** A parameter with neither a default value nor a question mark. */
function isRequired(parameter: string): boolean {
  return !parameter.includes('=') && !/^[\w\s]*\?\s*:/.test(parameter);
}
