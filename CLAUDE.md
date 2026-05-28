# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A GitHub Action (`markupai/content-guardian-action`) that analyzes content files (DITA, HTML, Markdown, plain text, XML) on commits/PRs against Markup AI's style agent. The Action's behavior is event-driven — it adapts what it reads, what it reports, and how it surfaces results based on the GitHub event type (`push`, `pull_request`, `workflow_dispatch`, `schedule`).

**v2 is a direct-API rewrite.** The action no longer depends on `@markupai/toolkit`; it calls `https://api.markup.ai/` directly via `fetch`, runs the style agent's `/run` endpoint per file, and polls workflow status until terminal. Inputs were collapsed: v1's `dialect` + `tone` + `style-guide` became a single required `target` input that accepts a target ID or display name.

Runtime: Node 24 (see `.node-version`, `engines.node`). The published action runs `dist/index.js` (see `action.yml`).

## Commands

```bash
npm install              # install deps
npm test                 # run all vitest tests (live-smoke is auto-skipped)
npm run test:coverage    # tests + v8 coverage (used in CI; feeds SonarQube)
npm run lint:check       # eslint (strict-type-checked config)
npm run lint:fix
npm run format:check     # prettier
npm run format:fix
npm run type-check       # tsc --noEmit against tsconfig.json
npm run package          # rollup bundle → dist/index.js
npm run bundle           # format:fix + package (this is what CI's "check-dist" runs)
npm run all              # lint + coverage + bundle (full local CI gate)
npm run local-action     # run main.ts locally via @github/local-action using .env
```

Run a single test file: `npx vitest run test/path/to/file.test.ts`. Watch mode: `npx vitest`.

Exercise the real API end-to-end (skipped without the key):

```bash
MARKUP_AI_LIVE_KEY=mat_... npx vitest run test/live-smoke.test.ts
```

## Critical: the `dist/` directory is committed

Because the action is consumed directly from this repo (`uses: markupai/content-guardian-action@v2` loads `dist/index.js`), the bundled output is checked in. The `check-dist.yml` workflow fails PRs whose `dist/` doesn't match a fresh `npm run bundle`. **Any source change must be followed by `npm run bundle` and a commit of the resulting `dist/` diff.** Don't hand-edit files under `dist/` — they are generated.

## Architecture

Entry chain: `dist/index.js` (rollup output) ← `src/index.ts` (calls `run()`) ← `src/main.ts` ← `src/action-runner.ts::runAction()`. All real orchestration lives in `action-runner.ts`.

The runner is a linear pipeline:

1. **Config** (`src/config/action-config.ts`) reads inputs/env via `@actions/core`, validates, and produces an `ActionConfig` with one required style input: `target`. Inputs fall back to env vars (e.g. `markup_ai_api_key` → `MARKUP_AI_API_KEY`).
2. **Bootstrap** — call `GET /style-agent/config` to read `style_agent_numeric_scoring` and assert style agent is enabled, then call `GET /style-agent/targets` and resolve the user's `target` input (by id or case-insensitive display_name) via `services/target-resolver.ts`. The resulting `AnalysisOptions` carries `{ targetId, targetDisplayName, numericScoringEnabled }`.
3. **File discovery** (`src/strategies/file-discovery-strategies.ts`) — strategy pattern keyed on `github.context.eventName`:
   - `push` → files touched in that commit (excluding deletions)
   - `pull_request` → files changed in the PR
   - `workflow_dispatch` / `schedule` → all repo files at `ref`
   - Unknown event types fall back to the push strategy with a warning.
4. **Filter** to supported extensions (`SUPPORTED_EXTENSIONS` in `src/constants/index.ts`): `.dita .htm .html .markdown .md .mdown .mkd .text .txt .xml`.
5. **Analysis** (`src/services/api-service.ts`) — per file: read content, `POST /agents/ag_vYCPHsSQnnJj/run?wait=false` with `{ text, document_name, document_ref, target_id }`, then poll `GET /agents/workflows/{id}` every 2s (5-minute timeout). Files are processed with a concurrency cap of 5 (`MAX_CONCURRENT_FILES`). The style agent ID is hardcoded — it's a stable platform identifier, not customer-scoped.
6. **Post-analysis** (`src/services/post-analysis-service.ts`) — dispatch on event type:
   - `push` → `updateCommitStatus` (gated by `addCommitStatus`).
   - `pull_request` → `createOrUpdatePRComment` always; `createPRReviewComments` only if `addReviewComments`.
   - `workflow_dispatch` / `schedule` → `createJobSummary` (writes `$GITHUB_STEP_SUMMARY` markdown).
7. **Outputs** — `event-type`, `files-analyzed`, `results` (JSON of `AnalysisResult[]`).
8. **Strict mode** — if `strict_mode: true` and any file failed to analyze, the action calls `core.setFailed("Some files were not analyzed.")` _after_ all post-analysis work has already run.

## Risk vs. numeric scoring

A single boolean — `numericScoringEnabled` from `GET /style-agent/config` — drives every output path.

- **Numeric on** (`style_agent_numeric_scoring: true`): result tables and commit statuses include `quality.score` (0–100). The summary averages the score across files.
- **Numeric off** (default for most orgs): the action shows only severity counts (`H:_ M:_ L:_`) and an overall risk label derived from `issues[].severity` (`high` if any high present, else `medium`, else `low`, else `none`). No fabricated scores.

In both modes the `outputs.results` JSON contains the full per-file `AnalysisResult` (including raw issues), so downstream steps don't lose information.

## API client (`src/services/markup-api-client.ts`)

Thin fetch-based wrapper. Single `request<T>()` helper sets `Authorization: Bearer <key>` and `x-integration-id: markupai-content-guardian-action`, JSON-decodes the body, and throws `MarkupApiError(status, requestId, body)` on non-2xx. Retries once on 5xx and on raw network errors; never retries on 4xx. `isFatalApiError()` returns true for 401 / 403 / 5xx — these abort the whole run from `api-service.analyzeFile`, while non-fatal failures (timeouts, individual workflow `failed` status) just drop that file from the result list.

## Services and where to extend

- `src/services/github-service.ts` — thin octokit wrapper (commit fetch, PR files, repo file walk, commit status with risk/numeric formatting).
- `src/services/pr-comment-service.ts` — summary PR comment + per-issue inline review comments. Branches on `numericScoringEnabled` for table headers; uses `issue.position.text` / `issue.guideline_name` / `issue.suggestion(s)` from the agent response.
- `src/services/job-summary-service.ts` — `$GITHUB_STEP_SUMMARY` markdown for manual/scheduled runs.
- `src/services/target-resolver.ts` — maps user input (id or display_name) to an enabled `StyleTarget`.
- `src/utils/issue-utils.ts` — `computeIssueCounts`, `classifyRisk`, `aggregateCounts`, `aggregateRisk` and the `RISK_EMOJI` / `RISK_LABEL` maps.
- `src/utils/score-utils.ts` — numeric-mode helpers only (`getQualityStatus`, `calculateScoreSummary`).
- `src/constants/index.ts` is the single source for input names, env var names, event types, extensions, API URL, integration ID, and the hardcoded `STYLE_AGENT_ID`.
- `src/types/index.ts` defines our own types — `AgentRunRequest/Response`, `WorkflowStatus`, `OrganizationConfigResponse`, `StyleTarget`, `StyleScores`, `StyleAnalysis`, `AnalysisIssue`, `IssueCounts`, `RiskLevel`, `AnalysisResult`, `ActionConfig`, `AnalysisOptions`.

## Local development

`npm run local-action` uses `@github/local-action` to run `src/main.ts` against `.env` (see `.env.example`). Env vars follow the GitHub Actions `INPUT_<NAME>` convention — and the runner is strict about it, so `INPUT_TARGET` keeps the underscore (the input name is `target`, not `style-guide` anymore). `.github/event.json` is a sample event payload for local PR runs.

## Tests

Vitest with `clearMocks: true`. `test/` mirrors `src/` (services, strategies, utils, config). `test/integration.test.ts` covers the runner end-to-end with mocked Markup AI client + GitHub API. `test/live-smoke.test.ts` exercises the real API — gated on `MARKUP_AI_LIVE_KEY` so it's auto-skipped without a key. Coverage uses v8 and is wired to SonarQube in CI (`sonar-project.properties`).
