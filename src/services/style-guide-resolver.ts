/**
 * Resolve the user-supplied style guide input against the org's enabled
 * style-agent style guides.
 *
 * Empty input → fall back to the style guide flagged `is_default: true` for the
 * org. Non-empty input → match either the exact id or the case-insensitive
 * display_name.
 */

import type { StyleGuide } from "../types/index.js";

export function resolveStyleGuide(input: string, styleGuides: StyleGuide[]): StyleGuide {
  const trimmed = input.trim();

  if (!trimmed) {
    const defaultStyleGuide = styleGuides.find((sg) => sg.is_default);
    if (defaultStyleGuide) return defaultStyleGuide;
    const available = styleGuides.map((sg) => `  - ${sg.display_name} (id: ${sg.id})`).join("\n");
    throw new Error(
      `No style guide was specified and the organization has no default style guide. Available style guides:\n${available || "  (none enabled)"}`,
    );
  }

  const byId = styleGuides.find((sg) => sg.id === trimmed);
  if (byId) return byId;

  const lower = trimmed.toLowerCase();
  const byName = styleGuides.find((sg) => sg.display_name.toLowerCase() === lower);
  if (byName) return byName;

  const available = styleGuides.map((sg) => `  - ${sg.display_name} (id: ${sg.id})`).join("\n");
  throw new Error(
    `No enabled style guide matches "${trimmed}". Available style guides:\n${available || "  (none enabled)"}`,
  );
}
