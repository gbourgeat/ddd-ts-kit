**The hooks of the plugin are held at 100 percent coverage by the pipeline.** Every line, branch
and function of the guard (`plugin/hooks/guard.mjs`), of its reader of shell commands and of its
record of the runs of a context-builder is reached by a test that gives the hook an input and
reads its answer, and a branch no test reaches fails `npm run test:plugin`, which `ci:arch` runs:
each promise of the guard has its test, its failing open included. The branches no hook input
could reach were removed. Nothing the guard refuses or allows changes.
