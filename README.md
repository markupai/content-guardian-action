# Markup AI GitHub Action

[![Build and Test](https://github.com/markupai/content-guardian-action/actions/workflows/build.yml/badge.svg)](https://github.com/markupai/content-guardian-action/actions/workflows/build.yml)
[![Coverage](https://github.com/markupai/content-guardian-action/blob/main/badges/coverage.svg)](https://github.com/markupai/content-guardian-action)

A GitHub Action that analyzes commit changes and runs style checks on modified
files via the Markup AI style agent. Automatically adapts to push, pull request,
manual, and scheduled events.

## What's new in v2

- **Direct agentic API** — no longer uses `@markupai/toolkit`; talks to
  `https://api.markup.ai` directly.
- **Single `target` input** — replaces v1's `dialect` / `tone` / `style-guide`
  combo. Pass a target ID or its display name (look up at
  [console.markup.ai](https://console.markup.ai)).
- **Risk-based scoring by default** — if your organization has numeric scoring
  disabled, the action surfaces severity counts and a risk label instead of
  fabricated scores. Numeric scoring is shown only when your org enables it.

Migrating from v1: drop `dialect`, `tone`, and `style-guide`; add `target`.

## Features

- 🔍 **Smart File Discovery**: Detects files to analyze based on the GitHub event
- 📝 **Event-Based Analysis**: Optimized behavior for push, pull request,
  manual, and scheduled events
- 📊 **Risk or numeric scoring**: Severity counts (high/medium/low) plus an
  overall risk label, or a 0–100 quality score, driven by your org config
- 🏷️ **Visual feedback**: Commit status updates, PR comments, inline review
  suggestions
- 📋 **Rich outputs**: JSON results and detailed reporting

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
          target: Marketing Voice
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
          target: ${{ secrets.MARKUP_AI_TARGET_ID }} # accepts ID or display name
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

| Input                 | Description                                                                       | Required | Default |
| --------------------- | --------------------------------------------------------------------------------- | -------- | ------- |
| `markup_ai_api_key`   | Markup AI API key (or `MARKUP_AI_API_KEY` env var)                                | Yes      | -       |
| `github_token`        | GitHub token (or `GITHUB_TOKEN` env var)                                          | Yes      | -       |
| `target`              | Style guide / target — accepts a target ID or its display name (case-insensitive) | Yes      | -       |
| `add_commit_status`   | Add commit status updates for push events                                         | No       | `true`  |
| `add_review_comments` | Add PR review comments for issues                                                 | No       | `true`  |
| `strict_mode`         | Fail the action if any file fails analysis                                        | No       | `false` |

## Outputs

| Output           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `event-type`     | Type of GitHub event that triggered the action |
| `files-analyzed` | Number of files analyzed                       |
| `results`        | JSON string containing analysis results        |

## Event types

### Push (`on: [push]`)

Analyzes files modified in the push. Updates the commit status with the overall
quality score (numeric mode) or risk label (risk mode).

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

## Risk vs. numeric scoring

The action queries `GET /style-agent/config` once per run. If your org has
`style_agent_numeric_scoring` enabled, the action shows:

- per-file quality score (0–100) and per-goal breakdown
- summary average quality across files
- commit status `Quality 78 | Files 4 | Issues 12 (H:1 M:5 L:6)`

If your org does not have numeric scoring enabled, the action shows:

- per-file severity counts (high / medium / low) and a risk label
- an overall risk = highest severity present across files
- commit status `Risk Medium | Files 4 | Issues 12 (H:1 M:5 L:6)`

In both modes the `outputs.results` JSON contains the full per-file structure so
downstream steps can act on the raw data.

## Finding your `target` value

```bash
curl -H "Authorization: Bearer $MARKUP_AI_API_KEY" \
  https://api.markup.ai/style-agent/targets | jq '.[] | {id, display_name}'
```

Pass either the `id` or `display_name` to the `target` input.

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
