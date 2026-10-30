node_modules
dist
/coverage/
.env
.envrc
# .env.local, .env.production and the like hold secrets too; the example is the one to share.
.env.*
!.env.example
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
