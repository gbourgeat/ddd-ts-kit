import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

{{#unless orm.prisma}}
{{#unless orm.typeorm}}
export default dddTsKit({ tsconfigRootDir: import.meta.dirname });
{{/unless}}
{{/unless}}
{{#if orm.prisma}}
// The Prisma client under generated/ is a build product: it is not linted.
export default dddTsKit({ tsconfigRootDir: import.meta.dirname, ignores: ['generated/**'] });
{{/if}}
{{#if orm.typeorm}}
// The migrations TypeORM writes are the output of a tool, compiled by the build: they are not linted.
export default dddTsKit({ tsconfigRootDir: import.meta.dirname, ignores: ['migrations/**'] });
{{/if}}
