node_modules
dist
/coverage/
.env
*.tsbuildinfo
.ddd-ts-kit/
.eslintcache/
.worktrees/
{{#if pm.pnpm}}
.pnpm-store/
{{/if}}
.stryker-tmp/
/reports/mutation/
{{#if orm.prisma}}
generated
{{/if}}
{{#if files.local}}
.data/
{{/if}}
