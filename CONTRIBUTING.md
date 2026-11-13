# Contributing to mish

mish is open to community contributions. Bug reports, fixes, tests, documentation corrections and
feature ideas are all welcome. The project is maintained by one person in their own time, so reviews
and replies are best effort rather than guaranteed.

## Priority: bugs before features

Bugs are triaged and fixed before new features. That ordering is deliberate: a disk-space tool that
reports the wrong number is worse than one that is missing a view.

- A correctness bug is highest priority — a wrong size, a wrong tree, a missed or double-counted
  file, a broken export, or anything that contradicts the documented behaviour.
- A crash, hang, leak or unbounded memory growth is treated the same way.
- Feature work lands when the bug queue is clear, or when a feature is required to fix a bug.
- Feature requests are read and kept, but they are not commitments. There is no delivery date.

## Ways to contribute

- **Report a bug.** Use the issue tracker and include the details listed below.
- **Fix a bug.** Small, focused pull requests are the easiest to review and merge.
- **Improve the docs.** `apps/site/src/content/docs/` holds the documentation source; the README
  covers the overview.
- **Add tests.** Coverage for a known failure is valuable even without a fix.
- **Suggest a feature.** Describe the problem and the use case, not only the proposed UI.

Security issues do not belong in the public tracker. Follow [`SECURITY.md`](SECURITY.md) instead.

## Reporting a bug

Search the existing issues first, then include:

- the mish version (`mish --version`, the image tag, or the `version` badge in the README);
- the deployment shape — compose, Portainer, source build, CLI only — and the host OS;
- what you did, what you expected, and what happened;
- the smallest reproduction you can manage, including the scanned path shape and the relevant flags
  (`--apparent`, `--one-file-system`, `--follow-symlinks`, exclusions, threads);
- logs, JSON output or a screenshot where it helps. Redact paths, usernames and container names you
  do not want public.

For a wrong-size report, say whether you compared against `du`, `df` or the Docker CLI, and whether
the discrepancy is in allocated or apparent size. Hardlinks, sparse files, mount boundaries and
permission errors are the usual explanations.

## Suggesting a feature

Open an issue that states the problem first: what you are trying to find out about a filesystem and
why the current views or commands do not answer it. Include the data shape if it matters (many small
files, deep trees, network mounts, containers). A roadmap will be published in the future; until
then, issues are the record of what people want.

Proposals that conflict with the project's constraints will be declined or reshaped. Those
constraints are not negotiable:

- the scanner stays streaming and bounded in memory;
- scanned files are never written to;
- Docker access stays read-only through a GET-only proxy;
- every CLI command and API surface keeps speaking JSON.

## Development setup

Prerequisites: Rust (pinned by `rust-toolchain.toml`), Bun, and Docker for integration tests.

```bash
cargo build --workspace
bun install
```

Run the pieces individually:

```bash
cargo run -p mish-cli -- daemon --socket /tmp/mish.sock --data-dir ./data
MISH_ROOTS=/var/data MISH_CORE_SOCKET=/tmp/mish.sock bun run --filter '@mish/server' dev
bun run --filter '@mish/web' dev
bun run --filter '@mish/site' dev
```

## Before you open a pull request

Run the same checks CI runs and fix what they report:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked

bun run check
bun run --filter '*' test
bun run --filter '*' build
```

`bun run check` covers Biome and the per-workspace typecheck. Do not hand-format code to satisfy a
linter rule; run the configured tooling instead.

## Pull request guidelines

- Branch from the current main branch and keep one concern per pull request. A bug fix should not
  carry an unrelated refactor.
- Explain the change in the description: the bug or use case, the approach, and anything a reviewer
  should look at closely.
- Add or update tests for changed public behaviour, including validation and authorization failures.
  Prefer behaviour-based assertions over private implementation details, and keep fixtures
  deterministic.
- Keep the Rust core and the TypeScript server in agreement. Wire types are generated from the IPC
  contract in `crates/mish-ipc/`; change the contract first, then regenerate rather than editing
  generated output.
- Update documentation when a command, flag, environment variable or API route changes. The docs
  source lives in `apps/site/src/content/docs/`.
- Bump the version in the affected `package.json` (patch for a fix, minor for a feature) and add a
  newest-first `CHANGELOG.md` entry that matches it. A docs-only change bumps the root package.
- Do not edit build output (`**/dist/`), `pnpm-lock.yaml`-style lockfiles by hand, generated
  migrations, or `.kilo/` state. Regenerate them with the documented command.
- Never commit secrets, tokens, `.env` files or real snapshot data.

## Coding standards

- Rust: keep the scanner streaming and allocation-conscious. The fast path is the reason the tool
  exists; a change that trades bounded memory for convenience needs a strong argument.
- TypeScript: relative imports use explicit `.js` extensions. Follow the existing module boundaries
  rather than reaching across packages.
- Styling: use CSS Modules co-located with the component. Do not duplicate selectors; extend the
  base rule and add `@media` overrides on it.
- Comments: explain non-obvious reasoning, not what the next line does.
- Stability and performance come before novelty. Prefer the simpler, measured option.

## Review and response times

This is a single-maintainer project. Expect days to weeks rather than hours. A pull request may sit
while a correctness bug is being fixed, because bugs come first. If a change goes quiet, a polite
ping on the pull request is fine.

## Community expectations

Be direct about code and considerate toward people. Reports and reviews should be about the
behaviour, not the author. Contributions that ignore the read-only and bounded-memory guarantees, or
that add telemetry, will be declined.

## License

By contributing, you agree that your contribution is licensed under GPL-3.0-or-later, the same
license as the project.
