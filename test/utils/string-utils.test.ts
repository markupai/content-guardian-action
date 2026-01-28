/**
 * Tests for string utilities
 */

import { describe, it, expect } from "vitest";
import { wrapInlineCode } from "../../src/utils/string-utils.js";

describe("string-utils", () => {
  describe("wrapInlineCode", () => {
    it("wraps values containing backticks", () => {
      const result = wrapInlineCode("Use `ap`, `chicago`, or `apa`.");
      expect(result).toBe("``Use `ap`, `chicago`, or `apa`.``");
    });

    it("pads when value starts with a backtick", () => {
      const result = wrapInlineCode("`apa`, or");
      expect(result).toBe("`` `apa`, or ``");
    });

    it("pads when value ends with a backtick", () => {
      const result = wrapInlineCode("use `apa`");
      expect(result).toBe("`` use `apa` ``");
    });
  });
});
