import { argumentsOf } from '../declarations/arguments-of';
import { bindingCalls } from '../declarations/binding-calls';
import { classesOf } from '../declarations/classes-of';
import { optionOf } from '../declarations/option-of';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { chainEnd } from '../text/chain-end';
import type { AdapterPolicy } from './adapter-policy';
import { statedTimeouts } from './stated-timeouts';

const ADAPTER_DECORATORS = ['Adapter', 'Gateway'];
const OWN_POLICY = /(?<![\w$.])ownPolicy\s*\(/;
const TO_CLASS = /\.\s*toClass\s*\(\s*([A-Za-z_$][\w$]*)/;
const AS = /\.\s*as\s*\(\s*/;

/**
 * The policy of each adapter the project binds to a port, where it is stated: the `@Adapter` or
 * `@Gateway` above a class (declared style), or the chain `bind(Port).toClass(Adapter).as(kind).with(...)`
 * of a file that imports the container of the kit. A platform wired by hand states nothing a text can follow.
 */
export function adapterPolicies(project: Project): AdapterPolicy[] {
  return project.files.filter((file) => !file.isTest).flatMap((file) => [...declared(file), ...bound(file)]);
}

function declared(file: SourceFile): AdapterPolicy[] {
  const { scan } = file;

  return classesOf(scan).flatMap(({ name, decorations }) =>
    decorations
      .filter((decoration) => ADAPTER_DECORATORS.includes(decoration.name))
      .map((decoration) => ({
        port: argumentsOf(scan, decoration)[0]?.code ?? '',
        className: name,
        kind: decoration.name === 'Gateway' ? 'gateway' : optionOf(scan, decoration, 'kind')?.literal,
        ...statedIn(scan.code.slice(decoration.open, decoration.close + 1)),
      })),
  );
}

function bound(file: SourceFile): AdapterPolicy[] {
  const { code, strings } = file.scan;

  return bindingCalls(file).flatMap(({ method, open, token }) => {
    const chain = code.slice(open, chainEnd(code, open + 1));
    const className = method === 'bind' ? TO_CLASS.exec(chain)?.[1] : undefined;

    if (className === undefined) {
      return [];
    }

    const as = AS.exec(chain);
    const kindAt = as === null ? -1 : open + as.index + as[0].length;

    return [
      {
        port: token?.code ?? '',
        className,
        kind: strings.find((literal) => literal.start === kindAt)?.value,
        ...statedIn(chain),
      },
    ];
  });
}

function statedIn(code: string): Pick<AdapterPolicy, 'ownPolicy' | 'timeouts' | 'readable'> {
  return { ownPolicy: OWN_POLICY.test(code), ...statedTimeouts(code, 'timeout') };
}
