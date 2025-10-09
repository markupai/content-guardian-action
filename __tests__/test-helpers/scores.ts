// Shared helpers for building score structures in tests to avoid duplication

export function buildQuality(
  score: number,
  issues: number = 1,
  overrides?: {
    grammarScore?: number;
    grammarIssues?: number;
    styleGuideScore?: number;
    styleGuideIssues?: number;
    terminologyScore?: number;
    terminologyIssues?: number;
  },
) {
  const grammarScore = overrides?.grammarScore ?? score;
  const styleGuideScore = overrides?.styleGuideScore ?? score;
  const terminologyScore = overrides?.terminologyScore ?? score;

  const grammarIssues = overrides?.grammarIssues ?? issues;
  const styleGuideIssues = overrides?.styleGuideIssues ?? issues;
  const terminologyIssues = overrides?.terminologyIssues ?? issues;

  return {
    score,
    grammar: { score: grammarScore, issues: grammarIssues },
    consistency: { score: styleGuideScore, issues: styleGuideIssues },
    terminology: { score: terminologyScore, issues: terminologyIssues },
  };
}

export function buildClarity(score: number) {
  return {
    score,
    word_count: 100,
    sentence_count: 10,
    average_sentence_length: 10,
    flesch_reading_ease: 10,
    vocabulary_complexity: 10,
    sentence_complexity: 10,
  };
}

export function buildTone(score: number) {
  return {
    score,
    informality: 10,
    liveliness: 10,
    informality_alignment: 10,
    liveliness_alignment: 10,
  };
}

export function buildScores(
  qualityScore: number,
  clarityScore: number,
  toneScore: number,
  options?: Parameters<typeof buildQuality>[2],
) {
  return {
    quality: buildQuality(qualityScore, options?.grammarIssues ?? 10, options),
    analysis: {
      clarity: buildClarity(clarityScore),
      tone: buildTone(toneScore),
    },
  };
}
