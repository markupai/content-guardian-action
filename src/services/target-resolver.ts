/**
 * Resolve the user-supplied target input against the org's enabled
 * style-agent targets.
 *
 * Empty input → fall back to the target flagged `is_default: true` for the
 * org. Non-empty input → match either the exact id or the case-insensitive
 * display_name.
 */

import type { StyleTarget } from "../types/index.js";

export function resolveTarget(input: string, targets: StyleTarget[]): StyleTarget {
  const trimmed = input.trim();

  if (!trimmed) {
    const defaultTarget = targets.find((t) => t.is_default);
    if (defaultTarget) return defaultTarget;
    const available = targets.map((t) => `  - ${t.display_name} (id: ${t.id})`).join("\n");
    throw new Error(
      `No target was specified and the organization has no default target. Available targets:\n${available || "  (none enabled)"}`,
    );
  }

  const byId = targets.find((t) => t.id === trimmed);
  if (byId) return byId;

  const lower = trimmed.toLowerCase();
  const byName = targets.find((t) => t.display_name.toLowerCase() === lower);
  if (byName) return byName;

  const available = targets.map((t) => `  - ${t.display_name} (id: ${t.id})`).join("\n");
  throw new Error(
    `No enabled target matches "${trimmed}". Available targets:\n${available || "  (none enabled)"}`,
  );
}
