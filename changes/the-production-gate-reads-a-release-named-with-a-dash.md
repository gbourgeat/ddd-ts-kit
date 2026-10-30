**The production gate reads a release named with a dash, an underscore or a dot.** `deploy-production`, `deploy_production` and `db:migrate-production` are held for approval as `deploy:production` is, and `non-production` and `pre-production` are not read as production.

To move: a project that wrote its production gate before keeps the old reading until it takes the new `.claude/hooks/production-gate.mjs` (`init --force` after saving the lists it edited).
