/**
 * Resolve the user-supplied target input (an id or a display_name)
 * against the org's enabled style-agent targets.
 */

import type { StyleTarget } from "../types/index.js";

export function resolveTarget(input: string, targets: StyleTarget[]): StyleTarget {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Target input is empty.");
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
