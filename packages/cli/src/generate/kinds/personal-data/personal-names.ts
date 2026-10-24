import type { OrmStack } from '../../../config';
import type { Name } from '../../../naming';
import { toName } from '../../../naming';
import { REPOSITORY_ADAPTERS } from '../repository-adapter';

/** The ports, the adapters and the fakes of the erasure and of the export of one context, named after it and after the ORM. */
export interface PersonalNames {
  readonly port: string;
  readonly portKebab: string;
  readonly adapter: string;
  readonly adapterKebab: string;
  readonly fake: string;
  /** The class the erasure adapter extends, with the type argument the storage of the project asks for. */
  readonly base: string;
  readonly exportPort: string;
  readonly exportPortKebab: string;
  readonly exportAdapter: string;
  readonly exportAdapterKebab: string;
  readonly exportFake: string;
  /** The class the export adapter extends, with the same type argument. */
  readonly exportBase: string;
}

/** The type argument the adapters of each ORM take: the context class of the generated platform. */
const TYPE_ARGUMENTS: Readonly<Record<string, string>> = {
  drizzle: '<PgQueryResultHKT>',
  prisma: '<Prisma.TransactionClient>',
};

export function personalNames(orm: OrmStack, context: Name): PersonalNames {
  const prefix = REPOSITORY_ADAPTERS[orm].prefix;
  const erasure = namesOf(prefix, `${context.pascal}PersonalDataErasure`, orm);
  const exported = namesOf(prefix, `${context.pascal}PersonalDataExport`, orm);

  return {
    port: erasure.port,
    portKebab: erasure.portKebab,
    adapter: erasure.adapter,
    adapterKebab: erasure.adapterKebab,
    fake: erasure.fake,
    base: erasure.base,
    exportPort: exported.port,
    exportPortKebab: exported.portKebab,
    exportAdapter: exported.adapter,
    exportAdapterKebab: exported.adapterKebab,
    exportFake: exported.fake,
    exportBase: exported.base,
  };
}

/** The names of one port of the context and of its adapter on the ORM, which extends the class of the same name in the ORM package. */
function namesOf(
  prefix: string,
  name: string,
  orm: OrmStack,
): Pick<PersonalNames, 'port' | 'portKebab' | 'adapter' | 'adapterKebab' | 'fake' | 'base'> {
  const port: Name = toName(name);
  const adapter: Name = toName(`${prefix}${port.pascal}`);
  const kind = port.pascal.replace(/^.*PersonalData/, 'PersonalData');

  return {
    port: port.pascal,
    portKebab: port.kebab,
    adapter: adapter.pascal,
    adapterKebab: adapter.kebab,
    fake: `Fake${port.pascal}`,
    base: `${prefix}${kind}${TYPE_ARGUMENTS[orm] ?? ''}`,
  };
}
