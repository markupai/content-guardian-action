# Markup AI GitHub Action

[![Build and Test](https://github.com/markupai/content-guardian-action/actions/workflows/build.yml/badge.svg)](https://github.com/markupai/content-guardian-action/actions/workflows/build.yml)
[![Coverage](https://github.com/markupai/content-guardian-action/blob/main/badges/coverage.svg)](https://github.com/markupai/content-guardian-action)

A GitHub Action that analyzes commit changes and runs style checks on modified
files. Automatically adapts to different GitHub events and provides detailed
quality analysis with commit status updates and PR comments.

## Features

- 🔍 **Smart File Discovery**: Automatically detects files to analyze based on
  GitHub event type
- 📝 **Event-Based Analysis**: Optimized behavior for push, pull request,
  manual, and scheduled events
- 📊 **Quality Scoring**: Detailed quality, clarity, grammar, and optional tone
  metrics
- 🏷️ **Visual Feedback**: Commit status updates
- 🔄 **Batch Processing**: Efficient analysis of multiple files
- 📋 **Rich Outputs**: JSON results and detailed reporting

## Supported File Types

- **Markdown**: `.md`, `.markdown`
- **Text**: `.txt`

## Usage

### Basic Usage

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

name: Analyze with Markup AI
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Analysis
        uses: markupai/content-guardian-action@v1
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Configuration

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
      - uses: actions/checkout@v4
      - name: Run Analysis
        uses: markupai/content-guardian-action@v1
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          dialect: 'british_english'
          style-guide: 'chicago'
          # tone is optional
          tone: 'academic'
          add_commit_status: 'true'
```

## Required Tokens

The action requires two tokens to function properly. You can provide them either
as action inputs or environment variables:

### API Token

- **Required**: Yes
- **Input name**: `markup_ai_api_key`
- **Environment variable**: `MARKUP_AI_API_KEY`
- **Purpose**: Authenticates with API for style checking

### GitHub Token

- **Required**: Yes
- **Input name**: `github_token`
- **Environment variable**: `GITHUB_TOKEN`
- **Purpose**: Authenticates with GitHub API for repository access

### Providing Tokens

**Option 1: As Action Inputs (Recommended)**

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

- name: Run Analysis
  uses: markupai/content-guardian-action@v1
  with:
    markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

**Option 2: As Environment Variables**

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

- name: Run Analysis
  uses: markupai/content-guardian-action@v1
  env:
    MARKUP_AI_API_KEY: ${{ secrets.MARKUP_AI_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Option 3: Mixed (Input takes precedence)**

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

- name: Run Analysis
  uses: markupai/content-guardian-action@v1
  with:
    markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input               | Description                                                                                     | Required | Default |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------- | ------- |
| `markup_ai_api_key` | API token for style checking. Can also be provided via `MARKUP_AI_API_KEY` environment variable | Yes      | -       |
| `github_token`      | GitHub token for API access. Can also be provided via `GITHUB_TOKEN` environment variable       | Yes      | -       |
| `dialect`           | Language dialect for analysis (for example, `american_english`, `british_english`)              | Yes      | -       |
| `style-guide`       | Style guide for analysis (for example, `ap`, `chicago`, `apa`)                                  | Yes      | -       |
| `tone`              | Tone for analysis (for example, `formal`, `informal`, `academic`)                               | No       | -       |
| `add_commit_status` | Whether to add commit status updates                                                            | No       | `true`  |

## Outputs

| Output           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `event-type`     | Type of GitHub event that triggered the action |
| `files-analyzed` | Number of files analyzed                       |
| `results`        | JSON string containing analysis results        |

## Event Types and Behavior

The action automatically adapts its behavior based on the GitHub event type:

### Push Events (`on: [push]`)

- **Scope**: Analyzes only files modified in the push
- **Features**: Commit status updates with quality score
- **Use Case**: Quick analysis of direct commits

### Pull Request Events (`on: [pull_request]`)

- **Scope**: Analyzes files changed in the PR
- **Features**: Detailed PR comments with analysis results
- **Use Case**: Pre-merge quality checks

### Manual Workflows (`on: [workflow_dispatch]`)

- **Scope**: Analyzes all supported files in the repository
- **Features**: Comprehensive repository-wide analysis
- **Use Case**: Manual quality checks and monitoring

### Scheduled Workflows (`on: [schedule]`)

- **Scope**: Analyzes all supported files in the repository
- **Features**: Periodic quality monitoring
- **Use Case**: Automated quality checks

## Examples

### Basic Push Analysis

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

name: Push Analysis
on: [push]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Analyze Changes
        uses: markupai/content-guardian-action@v1
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Pull Request Quality Gate

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write

name: PR Quality Check
on: [pull_request]
jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Quality Analysis
        id: analysis
        uses: markupai/content-guardian-action@v1
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          dialect: 'american_english'
          style-guide: 'ap'
          # tone is optional
          tone: 'formal'

      - name: Check Quality Score
        run: |
          results='${{ steps.analysis.outputs.results }}'
          # Add your quality threshold logic here
```

### Scheduled Repository Analysis

```yaml
name: Daily Quality Check
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch: # Manual trigger

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Full Repository Analysis
        uses: markupai/content-guardian-action@v1
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Using Outputs

```yaml
name: Analysis with Outputs
on: [push]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Analysis
        id: markup-ai-github-action
        uses: markupai/content-guardian-action@v1
        with:
          markup_ai_api_key: ${{ secrets.MARKUP_AI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - name: Display Results
        run: |
          echo "Event: ${{ steps.markup-ai-github-action.outputs.event-type }}"
          echo "Files: ${{ steps.markup-ai-github-action.outputs.files-analyzed }}"
          echo "Results: ${{ steps.markup-ai-github-action.outputs.results }}"
```

## Analysis Configuration

### Dialects

- `american_english` - American English
- `british_oxford` - British English
- `canadian_english` - Canadian English

### Tone (optional)

- `formal` - Formal writing style
- `informal` - Informal writing style
- `academic` - Academic writing style

### Style Guides

- `ap` - Associated Press Style Guide
- `chicago` - Chicago Manual of Style
- `microsoft` - Microsoft Writing Style Guide

## Quality Scoring

The action provides comprehensive quality metrics:

- **Quality Score**: Overall content quality assessment (0-100)
- **Clarity Score**: Readability and comprehension metrics
- **Grammar Score**: Grammar and syntax quality
- **Consistency Score**: Style guide compliance
- **Tone Score**: Tone appropriateness when tone is specified
- **Terminology Score**: Terminology consistency

### Quality Thresholds

- 🟢 **80+**: Excellent quality
- 🟡 **60-79**: Good quality with room for improvement
- 🔴 **0-59**: Needs significant improvement

## Visual Feedback

### Commit Status Updates (Push Events)

For push events, the action automatically updates commit status with:

- Quality score indicator
- Number of files analyzed
- Direct link to workflow run

### Pull Request Comments

For pull request events, the action creates detailed comments with:

- Quality score summary
- Detailed metrics table
- Configuration used
- Specific issues found

## Example Output

```

🔍 Running analysis on modified files... 📄 File: README.md 📈 Quality Score:
85.2 📝 Clarity Score: 78.5 🔤 Grammar Issues: 2 📋 Consistency Issues: 1 🎭
Tone Score: 82.3 📚 Terminology Issues: 0

⚠️ Issues Found:

1. passive_voice Original: "This document describes" Category: style_guide
   Position: 45
2. complex_sentence Original: "This document describes the new feature that was
   implemented" Category: sentence_structure Position: 67

```

## Error Handling

The action gracefully handles various scenarios:

- **Missing API Key**: Fails with clear error message
- **Missing GitHub token**: Shows warning and continues
- **API rate limits**: Logs error and continues execution
- **Invalid commit data**: Skips problematic commits
- **File read errors**: Logs warning and skips files
- **Network issues**: Provides clear error messages

## Security

- **API Token**: Store API token as GitHub secret
- **Token Validation**: Action validates required tokens
- **Secure Handling**: Tokens handled securely and not logged

## Local Development

### Prerequisites

- Node.js 24+
- API Key

### Setup

```bash
# Clone the repository
git clone https://github.com/markupai/content-guardian-action.git
cd `markup-ai-github-action`

# Install dependencies
npm install

# Set up environment variables
export MARKUP_AI_API_KEY=your-api-key
export GITHUB_TOKEN=your-github-token

# Run locally
npm run local-action
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Check formatting
npm run format:check

# Lint code
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

This project is licensed under the Apache-2.0 License - see the
[LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/markupai/content-guardian-action#readme)
- 🐛 [Issues](https://github.com/markupai/content-guardian-action/issues)
