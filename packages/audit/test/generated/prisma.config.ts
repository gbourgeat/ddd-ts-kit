import { defineConfig } from 'prisma/config';

export default defineConfig({ schema: './schema.prisma', datasource: { url: 'postgresql://unused:unused@127.0.0.1:1/unused' } });
