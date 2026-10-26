**The behaviour pages of `ddd-ts-kit docs` no longer open a rule with the row ids and criteria of its title.** A regression spec named `#FIX1 escalates ...` or an acceptance scenario named `#US1.04 AC1 a member declares ...` is written in `docs/behaviour/` as `escalates ...` and `a member declares ...`, read with the patterns `acceptance` uses for rows and criteria; the rest of the title is kept as it is.

To move: run `ddd-ts-kit docs` once to rewrite the pages.
