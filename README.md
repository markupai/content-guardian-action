# Markup AI GitHub Action

[![Build and Test](https://github.com/markupai/content-guardian-action/actions/workflows/build.yml/badge.svg)](https://github.com/markupai/content-guardian-action/actions/workflows/build.yml)
[![Coverage](https://github.com/markupai/content-guardian-action/blob/main/badges/coverage.svg)](https://github.com/markupai/content-guardian-action)

A GitHub Action that analyzes commit changes and runs style checks on modified
files via the Markup AI style agent. Automatically adapts to push, pull request,
manual, and scheduled events.

## What's new in v2

- **Direct agentic API** — no longer uses `@markupai/toolkit`; talks to
  `https://api.markup.ai` directly.
- **Single optional `target` input** — replaces v1's `dialect` / `tone` /
  `style-guide` combo. Omit it to use the organization's default target
  (the one flagged `is_default: true`); pass a target ID or display name
  to pin a specific one. Look them up at
  [console.markup.ai](https://console.markup.ai).
- **Risk-based scoring is the primary view, always.** Every PR comment, commit
  status, and job summary leads with a risk label and severity counts.
- **Numeric scoring is layered on, never replacing risk.** If your org has
  `style_agent_numeric_scoring` enabled, the action appends a Quality column
  to the table, an Overall Quality Score line to the summary, and a
  collapsible per-goal breakdown (Clarity / Grammar / Tone / Consistency / …).
- **PR comments are reconciled on every run.** The summary comment updates in
  place; inline review comments at fixed-issue lines are deleted automatically
  on the next run (see [Comment lifecycle](#pull-request-on-pull_request)).

Migrating from v1: drop `dialect`, `tone`, and `style-guide`. The new
`target` input is optional — set your org's default target in
[console.markup.ai](https://console.markup.ai) and you don't need to pass
anything; otherwise pass `target: <id or display name>`.

## Features

- 🔍 **Smart file discovery**: Detects files to analyze based on the GitHub event
- 📝 **Event-based analysis**: Optimized behavior for push, pull request,
  manual, and scheduled events
- 📊 **Risk-based scoring (always) + optional numeric layer**: Severity counts
  (high/medium/low) and an overall risk label in every output; per-file 0–100
  quality scores and per-goal breakdown appended when your org has numeric
  scoring enabled
- 🏷️ **Self-managing PR comments**: A single summary comment is updated in
  place; inline review comments are created, updated, or deleted to match the
  current analysis — no accumulation of stale comments
- 📋 **Rich outputs**: Full JSON of every analysis result (issues, scores when
  available, workflow IDs) for downstream consumers

## Supported file types

- **DITA**: `.dita`, `.xml`
- **HTML**: `.htm`, `.html`
- **Markdown**: `.md`, `.markdown`, `.mdown`, `.mkd`
- **Text**: `.text`, `.txt`

## Usage

### Basic usage

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

name: Analyze with Markup AI
on: [push, pull_request]

# Recommended: cancel the previous in-flight run when a new commit lands on the
# same PR. The action reconciles its inline review comments against the latest
# analysis (creating, updating, and deleting tagged comments as needed); two
# overlapping runs can race on that reconciliation if both read the same
# starting state.
concurrency:
  group: markup-ai-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Run Analysis
        uses: markupai/content-guardian-action@v2
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          # `target` omitted → uses the organization's default target.
```

### Advanced configuration

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

name: Analysis
on: [push]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Run Analysis
        uses: markupai/content-guardian-action@v2
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          target: ${{ secrets.MARKUP_AI_TARGET_ID }} # optional — accepts ID or display name; omit to use the org's default
          add_commit_status: "true"
          add_review_comments: "true"
          strict_mode: "false"
```

## Required tokens

### API token

- **Required**: Yes
- **Input name**: `markup_ai_api_key`
- **Environment variable**: `MARKUP_AI_API_KEY`
- **Get one**: Sign up at [console.markup.ai](https://console.markup.ai)

### GitHub token

- **Required**: Yes
- **Input name**: `github_token`
- **Environment variable**: `GITHUB_TOKEN`

Either inputs or env vars work; inputs take precedence when both are set.

## Inputs

| Input                 | Description                                                                                                                                                        | Required | Default     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| `markup_ai_api_key`   | Markup AI API key (or `MARKUP_AI_API_KEY` env var)                                                                                                                 | Yes      | -           |
| `github_token`        | GitHub token (or `GITHUB_TOKEN` env var)                                                                                                                           | Yes      | -           |
| `target`              | Style guide / target — target ID or display_name (case-insensitive). Omit to use the org's default target.                                                         | No       | org default |
| `paths`               | Comma- or newline-separated repo-relative paths. When set, intersects with the discovered files; only matches are analyzed. Empty = analyze everything discovered. | No       | (none)      |
| `add_commit_status`   | Add commit status updates for push events                                                                                                                          | No       | `true`      |
| `add_review_comments` | Add PR review comments for issues                                                                                                                                  | No       | `true`      |
| `strict_mode`         | Fail the action if any file fails analysis                                                                                                                         | No       | `false`     |
| `dry_run`             | Run the full analysis but skip every GitHub-side write (PR comments, inline reviews, commit status, job summary). Useful for self-testing without polluting a PR.  | No       | `false`     |

## Outputs

| Output           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `event-type`     | Type of GitHub event that triggered the action |
| `files-analyzed` | Number of files analyzed                       |
| `results`        | JSON string containing analysis results        |

## Event types

### Push (`on: [push]`)

Analyzes files modified in the push. Updates the commit status on the pushed
SHA with the overall risk label (and, if numeric scoring is enabled for the
org, the average quality score appended after it). The commit status state
itself — `success` / `failure` / `error` — is always derived from the risk
level so PR checks behave consistently regardless of scoring mode.

### Pull request (`on: [pull_request]`)

Analyzes files changed in the PR. Posts a single PR comment with the results
table and inline review comments for each flagged line.

**Comment lifecycle.** On every run the action:

1. Updates its existing summary comment in place (one comment per PR, never duplicated).
2. Reconciles the set of inline review comments against the current analysis — new findings are posted, changed bodies are updated in place, and comments whose underlying issue is gone are **deleted**. The PR stays in sync with the latest state.

The action only touches comments it owns; both the summary and review comments are tagged with a hidden HTML marker (`<!-- markup-ai-action:summary -->` / `<!-- markup-ai-action:review -->`). Comments from other tools or humans are never modified.

If two pushes hit the PR within seconds of each other, the two runs can race on the reconciliation. Use the `concurrency` block shown in the [Basic usage](#basic-usage) example to serialize runs per PR.

### Manual (`on: [workflow_dispatch]`) and scheduled (`on: [schedule]`)

Analyzes every supported file in the repository at the current ref. Writes the
results to the workflow's job summary.

## Scoring: risk-based (always) + optional numeric

The action queries `GET /style-agent/config` once per run to check whether
your org has `style_agent_numeric_scoring` enabled.

**Risk-based scoring is always shown** — it doesn't depend on the org flag:

- Each file gets a risk label derived from the worst severity issue on it:
  `🔴 High` if any high-severity issue is present, else `🟡 Medium` if any
  medium, else `🟢 Low`, else `✅ No issues`.
- The PR summary leads with `Overall Risk` (the worst level across files) and
  shows total issue counts broken down by severity (`H:_ M:_ L:_`).
- The commit status posted to the head SHA leads with `Risk <level>` and its
  `state` is `error` for `High`, `failure` for `Medium`, otherwise `success`.

**Numeric scoring is layered on additively** when the org enables it. The
per-file Quality column, the Overall Quality Score line, and the per-goal
`<details>` block all appear _alongside_ the risk view — never as a
replacement. Example PR-comment table in numeric mode:

```
| File             | Risk    | Issues | Breakdown      | Quality |
|:-----------------|:-------:|:------:|:---------------|:-------:|
| README.md        | 🟡 Medium | 8    | H:1 M:4 L:3   | 🟡 74   |
| docs/api.md      | 🔴 High   | 15   | H:7 M:5 L:3   | 🔴 52   |
```

…with a collapsible per-goal section under the table:

```
<details>
<summary>Per-goal breakdown</summary>

**README.md** — Clarity 78 · Grammar 91 · Tone 62 · Consistency 65
**docs/api.md** — Clarity 60 · Grammar 55 · Tone 50 · Consistency 40

</details>
```

Commit status format:

- Numeric off: `Risk Medium | Files 4 | Issues 12 (H:1 M:5 L:6)`
- Numeric on: `Risk Medium | Quality 74 | Files 4 | Issues 12 (H:1 M:5 L:6)`

The full per-file structure (issues, scores when available, workflow IDs) is
always available in the `outputs.results` JSON for downstream consumers,
regardless of which view is rendered.

## Finding your `target` value

The `target` input is **optional**. When omitted, the action uses the
organization's default target — the one flagged `is_default: true` in
`/style-agent/targets`. Configure that default in
[console.markup.ai](https://console.markup.ai); most teams only need to set
it once and never pass `target` in the workflow.

To pin a specific non-default target, look up the available targets and pass
either the `id` or the `display_name`:

```bash
curl -H "Authorization: Bearer $MARKUP_AI_API_KEY" \
  https://api.markup.ai/style-agent/targets | jq '.[] | {id, display_name, is_default}'
```

## Narrowing analysis with `paths`

By default, the action analyzes every supported file the event surfaces (every
file modified in the push, every file changed in the PR, or every supported
file in the repo for `workflow_dispatch` / `schedule`). When you want a
narrower scope, set the `paths` input:

```yaml
- uses: markupai/content-guardian-action@v2
  with:
    paths: README.md
```

Or multiple files:

```yaml
- uses: markupai/content-guardian-action@v2
  with:
    paths: |
      README.md
      docs/intro.md
      CONTRIBUTING.md
```

Behaviour:

- Empty / not set → no filtering (current default behaviour).
- Set → the discovered file list is intersected with the whitelist before any
  files are sent to the style agent. If none of the discovered files match,
  the run short-circuits with `files-analyzed=0`.
- Paths are matched exactly (after both sides are normalized to repo-relative
  posix paths). No globs today; pass each file you want to gate on.

Typical use: drop a `paths: README.md` on the action's own self-test
workflow so the build matrix exercises the wire path on every PR without
spamming a 20-file analysis result.

## Dry-run mode

`dry_run: true` runs the full analysis pipeline (config fetch, target
resolution, `/run`, polling, response parsing) and still populates
`outputs.results` with the full per-file JSON, but **skips every write to
GitHub**: no PR comment, no inline review comments, no commit status, no
job summary. The rendered markdown that _would_ have been posted is logged
to the run output so you can preview it.

```yaml
- uses: markupai/content-guardian-action@v2
  with:
    markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    dry_run: "true"
```

Typical uses:

- Self-testing the action's CI on its own PRs without polluting the PR
  with 30+ inline comments — the analysis still runs against the live
  Markup AI API so the wire path is exercised.
- Letting downstream steps key on `outputs.results` JSON without showing
  anything to PR reviewers.

## Strict mode

- **`false` (default)**: Continue even if some files fail to analyze. Successful
  files are reported.
- **`true`**: Fail the action with the message "Some files were not analyzed" if
  any file fails — use this for hard PR quality gates.

## Local development

### Prerequisites

- Node.js 24+ (see `.node-version`)
- A Markup AI API key

### Setup

```bash
git clone https://github.com/markupai/content-guardian-action.git
cd content-guardian-action
npm install
```

### Run locally with @github/local-action

```bash
cp .env.example .env
# edit .env: set INPUT_MARKUP_AI_API_KEY, INPUT_GITHUB_TOKEN, INPUT_TARGET
npm run local-action
```

### Tests, lint, type-check, bundle

```bash
npm test              # vitest run
npm run test:coverage # + v8 coverage report
npm run lint:check    # eslint (strict-type-checked)
npm run type-check    # tsc --noEmit
npm run bundle        # format:fix + rollup → dist/index.js
npm run all           # lint + coverage + bundle (full CI gate)
```

**Important:** `dist/index.js` is committed and required by the action. The
`check-dist.yml` workflow fails any PR whose `dist/` is stale — so after a source
change run `npm run bundle` and commit the result.

## Contributing

1. Fork the repository
2. Branch off `main` (`git checkout -b feature/xyz`)
3. Make your changes, add tests, and run `npm run all`
4. Commit the regenerated `dist/`
5. Open a PR

## License

Apache-2.0 — see [LICENSE](LICENSE).

## Support

- 📖 [Documentation](https://github.com/markupai/content-guardian-action#readme)
- 🐛 [Issues](https://github.com/markupai/content-guardian-action/issues)
