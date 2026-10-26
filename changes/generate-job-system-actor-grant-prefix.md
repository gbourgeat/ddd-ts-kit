**`generate job` under relationships relates the system actor of the job as `system:<job>`, not `system:system:<job>`.**

The tuple written in `platform/auth/relationships/relate-system-actors.ts` carried the prefix
twice, so the actor of the job (`system:<context>.<job>`) held no right and every run was refused
`FORBIDDEN` before its handler ran.

To move: a job generated before this version has `system:system:` in its line of
`relate-system-actors.ts`: remove one `system:`.
