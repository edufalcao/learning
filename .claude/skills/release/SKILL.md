---
name: release
description: Cut a new release — runs verification, commits, pushes, tags, and creates a GitHub release
disable-model-invocation: true
argument-hint: "[version-number]"
---

# Release Workflow

Cut release version `$ARGUMENTS` for learning hub.

## Steps

Execute these in exact order. Stop and report if any step fails.

### 1. Verification checklist

Run all three commands. Every one must pass.

```bash
pnpm lint
pnpm typecheck
pnpm generate
```

### 2. Commit

Stage any remaining release-ready changes.

Write the commit message to `.git/COMMIT_MSG_TEMP` using the Write tool, then commit with `git commit -F .git/COMMIT_MSG_TEMP`. Never use heredocs for commit messages.

Commit message format:
```
Prepare v$ARGUMENTS release

<one-line summary of what changed since last release>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

If there are no staged changes (docs-only release with nothing new to commit), skip the commit.

### 3. Push main

> **Note:** Pushing to main triggers automatic deployment to Cloudflare Pages via GitHub Actions.

```bash
git push origin main
```

### 4. Tag and push tag

```bash
git tag v$ARGUMENTS
git push origin v$ARGUMENTS
```

### 5. Create GitHub release

Generate release notes from commits since the previous tag (if no previous tag exists, use `--root` for the first release):

```bash
# If previous tags exist:
git log $(git describe --tags --abbrev=0 v$ARGUMENTS^)..v$ARGUMENTS --oneline

# If this is the first release:
git log v$ARGUMENTS --oneline
```

Create the release:

```bash
gh release create v$ARGUMENTS --title "v$ARGUMENTS" --latest --notes "<notes>"
```

Use category headers like `## Summary`, `### Features`, `### Fixes`, `### Docs` as appropriate.

## Final report

After all steps complete, summarize:
- Commit hash
- Tag name
- GitHub release URL
