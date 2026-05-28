import { describe, it, expect } from "vitest";
import { resolveTarget } from "../../src/services/target-resolver.js";
import type { StyleTarget } from "../../src/types/index.js";

const targets: StyleTarget[] = [
  { id: "tgt_a", display_name: "Marketing Voice", is_default: true, enabled: true },
  { id: "tgt_b", display_name: "Legal Terms", is_default: false, enabled: true },
];

describe("resolveTarget", () => {
  it("matches by id (exact)", () => {
    expect(resolveTarget("tgt_a", targets).id).toBe("tgt_a");
  });

  it("matches by display_name (case-insensitive)", () => {
    expect(resolveTarget("marketing voice", targets).id).toBe("tgt_a");
    expect(resolveTarget("LEGAL TERMS", targets).id).toBe("tgt_b");
  });

  it("trims whitespace", () => {
    expect(resolveTarget("  Marketing Voice  ", targets).id).toBe("tgt_a");
  });

  it("throws with available targets when input does not match", () => {
    let err: unknown;
    try {
      resolveTarget("nope", targets);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toMatch(/Marketing Voice/);
    expect(message).toMatch(/Legal Terms/);
    expect(message).toMatch(/tgt_a/);
  });

  it("falls back to the org's default target when input is empty", () => {
    expect(resolveTarget("", targets).id).toBe("tgt_a");
    expect(resolveTarget("   ", targets).id).toBe("tgt_a");
  });

  it("throws when input is empty and no default target exists", () => {
    const noDefault: StyleTarget[] = [
      { id: "tgt_a", display_name: "Marketing Voice", is_default: false, enabled: true },
      { id: "tgt_b", display_name: "Legal Terms", is_default: false, enabled: true },
    ];
    expect(() => resolveTarget("", noDefault)).toThrow(/no default target/);
  });

  it("includes a helpful message when no targets are enabled", () => {
    expect(() => resolveTarget("anything", [])).toThrow(/none enabled/);
  });
});
