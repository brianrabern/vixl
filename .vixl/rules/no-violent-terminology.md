# No violent terminology

Do not use violent or hostile metaphors in code, comments, docs, UI strings, commits, or PR text. Use neutral wording instead.

Preferred replacements:

- trigger → start, begin, run, fire only if unavoidable (prefer start)
- kill → stop, terminate → stop
- abort → cancel
- destroy → remove, delete
- execute → run
- slave → replica, follower
- master → main, primary
- whitelist / blacklist → allowlist / denylist
- sanity check → validation, consistency check

Rename identifiers only when it does not break stable external contracts (public APIs, CLI flags, vendored code). New code must always use the neutral terms.