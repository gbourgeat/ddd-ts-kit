import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

{{#unless orm.prisma}}
export default dddTsKit({ tsconfigRootDir: import.meta.dirname });
{{/unless}}
{{#if orm.prisma}}
// The Prisma client under generated/ is a build product: it is not linted.
export default dddTsKit({ tsconfigRootDir: import.meta.dirname, ignores: ['generated/**'] });
{{/if}}
