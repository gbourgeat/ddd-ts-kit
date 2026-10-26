**The agent denies the secret files of a project by name, and reads `.env.example` again.**
`init` denied `Read(./.env.*)` with the negation `Read(!./.env.example)` to keep the example readable. The sandbox of Claude Code ignores the negation and masks `.env.example` with `/dev/null`, which breaks git in the session. The deny list names `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development` and `.env.test`, and no rule carries a `!`.

To move: a project written before this change keeps the glob and its negation in `.claude/settings.json`; replace them by the six rules above (`init` adds the missing ones and says so, but does not remove the old pair).
