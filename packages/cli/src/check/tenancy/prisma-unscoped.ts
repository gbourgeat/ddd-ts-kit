import type { SourceFile } from '../model/source-file';
import { accessorUses, type AccessorUse } from './accessor-uses';
import { declaredInArguments } from './declared-in-arguments';

/** What confines a read to the tenants of the work. */
const CONDITION = /(?<![\w$])(?:tenantWhere|ownTenantWhere)\s*\(/;

/** What confines an update or a delete to the one tenant of the work. */
const OWN_CONDITION = /(?<![\w$])ownTenantWhere\s*\(/;

/** What names the tenant of a created row. */
const TENANT_OF_ROW = /(?<![\w$])tenantScopeOf\s*\(/;

const BY_KEY = /\.(findUnique|findUniqueOrThrow|upsert)\s*\(/;
const WRITE = /\.(update|updateMany|delete|deleteMany)\s*\(/;
const INSERT = /\.(create|createMany|createManyAndReturn)\s*\(/;
const READ = /\.(findFirst|findFirstOrThrow|findMany|count|aggregate|groupBy)\s*\(/;
const RAW = /\.\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)\b/;

/** What a statement on the client has to carry: the method that found it, and the helper its arguments must name. */
interface Guard {
  readonly method: string;
  readonly pattern: RegExp;
}

/** What a Prisma adapter of tenant data reaches without the helpers, judged statement by statement on the client. */
export function prismaUnscoped(file: SourceFile): readonly { offset: number; message: string }[] {
  const { code } = file.scan;

  return accessorUses(code, 'client').flatMap((use) => {
    const message = use.handedOver ? undefined : unscopedStatement(code, use);

    return message === undefined ? [] : [{ offset: use.offset, message }];
  });
}

function unscopedStatement(code: string, use: AccessorUse): string | undefined {
  const { statement } = use;

  if (RAW.test(statement)) {
    return 'Raw SQL reaches the tables with no tenant condition.';
  }

  const byKey = BY_KEY.exec(statement)?.[1];

  if (byKey !== undefined) {
    return `${byKey} reaches a row by its key alone, and the tenant is never part of the key: read with findFirst and write with createMany or updateMany, each confined to the tenant.`;
  }

  return unconfinedStatement(code, use);
}

function unconfinedStatement(code: string, use: AccessorUse): string | undefined {
  const { statement } = use;
  const write = WRITE.exec(statement)?.[1];

  if (write !== undefined) {
    return confined(code, use, { method: write, pattern: OWN_CONDITION })
      ? undefined
      : 'A write names no tenant: spread ownTenantWhere(this.scope) into its where.';
  }

  const insert = INSERT.exec(statement)?.[1];

  if (insert !== undefined) {
    return confined(code, use, { method: insert, pattern: TENANT_OF_ROW })
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  const read = READ.exec(statement)?.[1];

  if (read !== undefined) {
    return confined(code, use, { method: read, pattern: CONDITION })
      ? undefined
      : 'A read reaches the model with no tenant condition: spread tenantWhere(this.scope) into its where.';
  }

  return 'The client is used other than through a statement this rule can judge (held in a variable, a transaction).';
}

/** The helper is written in the statement, or in a local the arguments of the call name. */
function confined(code: string, { statement, offset }: AccessorUse, { method, pattern }: Guard): boolean {
  const call = new RegExp(`\\.${method}\\s*\\(`);

  return pattern.test(statement) || declaredInArguments(code, { statement, call, at: offset }, pattern);
}
