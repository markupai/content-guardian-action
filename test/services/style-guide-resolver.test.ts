import { describe, it, expect } from "vitest";
import { resolveStyleGuide } from "../../src/services/style-guide-resolver.js";
import type { StyleGuide } from "../../src/types/index.js";

const styleGuides: StyleGuide[] = [
  { id: "sg_a", display_name: "Marketing Voice", is_default: true, enabled: true },
  { id: "sg_b", display_name: "Legal Terms", is_default: false, enabled: true },
];

describe("resolveStyleGuide", () => {
  it("matches by id (exact)", () => {
    expect(resolveStyleGuide("sg_a", styleGuides).id).toBe("sg_a");
  });

  it("matches by display_name (case-insensitive)", () => {
    expect(resolveStyleGuide("marketing voice", styleGuides).id).toBe("sg_a");
    expect(resolveStyleGuide("LEGAL TERMS", styleGuides).id).toBe("sg_b");
  });

  it("trims whitespace", () => {
    expect(resolveStyleGuide("  Marketing Voice  ", styleGuides).id).toBe("sg_a");
  });

  it("throws with available style guides when input does not match", () => {
    let err: unknown;
    try {
      resolveStyleGuide("nope", styleGuides);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toMatch(/Marketing Voice/);
    expect(message).toMatch(/Legal Terms/);
    expect(message).toMatch(/sg_a/);
  });

  it("falls back to the org's default style guide when input is empty", () => {
    expect(resolveStyleGuide("", styleGuides).id).toBe("sg_a");
    expect(resolveStyleGuide("   ", styleGuides).id).toBe("sg_a");
  });

  it("throws when input is empty and no default style guide exists", () => {
    const noDefault: StyleGuide[] = [
      { id: "sg_a", display_name: "Marketing Voice", is_default: false, enabled: true },
      { id: "sg_b", display_name: "Legal Terms", is_default: false, enabled: true },
    ];
    expect(() => resolveStyleGuide("", noDefault)).toThrow(/no default style guide/);
  });

  it("includes a helpful message when no style guides are enabled", () => {
    expect(() => resolveStyleGuide("anything", [])).toThrow(/none enabled/);
  });
});
